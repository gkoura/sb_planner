"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown, Clipboard, FileImage, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { buildMonthWeeks } from "@/lib/month-calendar";
import { SCHEDULE_COLORS } from "@/lib/schedule-colors";
import { buttonVariants } from "@/components/ui/button";

type ExportMember = {
  id: string;
  nameSnapshot: string;
  roleSnapshot: string;
};

type ExportAssignment = {
  date: string;
  planningMemberId: string;
  nameSnapshot: string;
  roleSnapshot: string;
  shadows?: {
    shadowMemberId: string;
    nameSnapshot: string;
    roleSnapshot: string;
    kind: "TRAINING" | "MENTORING";
  }[];
};

function weekday(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function csvCell(value: string) {
  const safeValue = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(content: string, filename: string, mimeType: string) {
  downloadBlob(new Blob([content], { type: `${mimeType};charset=utf-8` }), filename);
}

function buildScheduleSvg({
  year,
  month,
  version,
  members,
  assignments,
  title,
}: {
  year: number;
  month: number;
  version: number;
  members: ExportMember[];
  assignments: ExportAssignment[];
  title: string;
}) {
  const width = 1200;
  const padding = 56;
  const gridWidth = width - padding * 2;
  const columnGap = 10;
  const columnWidth = (gridWidth - columnGap * 6) / 7;
  const headerHeight = 42;
  const rowHeight = 102;
  const rowGap = 10;
  const gridTop = 174;
  const weeks = buildMonthWeeks(year, month);
  const legendColumns = 3;
  const legendRows = Math.ceil(members.length / legendColumns);
  const legendTop = gridTop + headerHeight + weeks.length * (rowHeight + rowGap) + 28;
  const height = legendTop + Math.max(1, legendRows) * 40 + 48;
  const colorsByMemberId = new Map(
    members.map((member, index) => [member.id, SCHEDULE_COLORS[index % SCHEDULE_COLORS.length]]),
  );
  const assignmentsByDate = new Map(assignments.map((assignment) => [assignment.date, assignment]));
  const assignmentsByMember = new Map<string, number>();
  const shadowsByMember = new Map<string, number>();
  assignments.forEach((assignment) => {
    assignmentsByMember.set(
      assignment.planningMemberId,
      (assignmentsByMember.get(assignment.planningMemberId) ?? 0) + 1,
    );
    for (const shadow of assignment.shadows ?? []) {
      shadowsByMember.set(shadow.shadowMemberId, (shadowsByMember.get(shadow.shadowMemberId) ?? 0) + 1);
    }
  });
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" rx="28" fill="#f8faf9"/>`,
    `<text x="${padding}" y="76" fill="#123b3d" font-family="Arial,sans-serif" font-size="34" font-weight="700">${escapeXml(title)}</text>`,
    `<text x="${padding}" y="112" fill="#5f7473" font-family="Arial,sans-serif" font-size="17">Official standby schedule · Version ${version}</text>`,
  ];

  weekdays.forEach((label, index) => {
    const x = padding + index * (columnWidth + columnGap) + columnWidth / 2;
    svg.push(`<text x="${x}" y="${gridTop + 26}" text-anchor="middle" fill="#526967" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="1">${label.toUpperCase()}</text>`);
  });

  weeks.forEach((week, weekIndex) => {
    week.forEach((cell, weekdayIndex) => {
      if (!cell) return;
      const x = padding + weekdayIndex * (columnWidth + columnGap);
      const y = gridTop + headerHeight + weekIndex * (rowHeight + rowGap);
      const assignment = assignmentsByDate.get(cell.date);
      const color = assignment ? colorsByMemberId.get(assignment.planningMemberId) : undefined;
      const background = color?.background ?? "#ffffff";
      const foreground = color?.foreground ?? "#647574";
      const label = assignment?.nameSnapshot ?? "Open";
      const visibleName = label.length > 19 ? `${label.slice(0, 18)}…` : label;
      svg.push(`<rect x="${x}" y="${y}" width="${columnWidth}" height="${rowHeight}" rx="14" fill="${background}" stroke="${foreground}" stroke-opacity="0.28"/>`);
      svg.push(`<text x="${x + 14}" y="${y + 24}" fill="${foreground}" font-family="Arial,sans-serif" font-size="15" font-weight="700">${cell.day}</text>`);
      svg.push(`<text x="${x + 14}" y="${y + 65}" fill="${foreground}" font-family="Arial,sans-serif" font-size="14" font-weight="700">${escapeXml(visibleName)}</text>`);
      const shadowLabels = (assignment?.shadows ?? []).map((shadow) => `${shadow.kind === "TRAINING" ? "Shadow" : "Mentor"}: ${shadow.nameSnapshot}`).join(", ");
      if (shadowLabels) {
        const visibleShadows = shadowLabels.length > 28 ? `${shadowLabels.slice(0, 27)}…` : shadowLabels;
        svg.push(`<text x="${x + 14}" y="${y + 87}" fill="#334155" font-family="Arial,sans-serif" font-size="10">${escapeXml(visibleShadows)}</text>`);
      }
      if (assignment?.roleSnapshot === "ADMIN") {
        svg.push(`<text x="${x + 14}" y="${y + (shadowLabels ? 99 : 85)}" fill="${foreground}" font-family="Arial,sans-serif" font-size="11">ADMIN</text>`);
      }
    });
  });

  members.forEach((member, index) => {
    const column = index % legendColumns;
    const row = Math.floor(index / legendColumns);
    const x = padding + column * (gridWidth / legendColumns);
    const y = legendTop + row * 40;
    const color = colorsByMemberId.get(member.id);
    svg.push(`<circle cx="${x + 7}" cy="${y + 8}" r="7" fill="${color?.foreground ?? "#526967"}"/>`);
    const totalDays = (assignmentsByMember.get(member.id) ?? 0) + (shadowsByMember.get(member.id) ?? 0);
    svg.push(`<text x="${x + 24}" y="${y + 13}" fill="#233c3b" font-family="Arial,sans-serif" font-size="14" font-weight="600">${escapeXml(member.nameSnapshot)}${member.roleSnapshot === "ADMIN" ? " (admin)" : ""} · ${totalDays} days</text>`);
  });

  svg.push("</svg>");
  return svg.join("");
}

export function ScheduleExportMenu({
  title,
  year,
  month,
  version,
  members,
  assignments,
}: {
  title: string;
  year: number;
  month: number;
  version: number;
  members: ExportMember[];
  assignments: ExportAssignment[];
}) {
  const filename = `standby-schedule-${year}-${String(month).padStart(2, "0")}`;

  async function copyMarkdown() {
    const rows = assignments.map((assignment) =>
      `| ${assignment.date} | ${weekday(assignment.date)} | ${assignment.nameSnapshot.replaceAll("|", "\\|").replace(/\r?\n/g, "<br>")} | ${(assignment.shadows ?? []).map((shadow) => `${shadow.kind === "TRAINING" ? "Shadow" : "Mentor"}: ${shadow.nameSnapshot}`).join(", ") || "—"} |`,
    );
    const markdown = [
      `# ${title} standby schedule`,
      "",
      `Official version ${version}`,
      "",
      "| Date | Day | Standby engineer | Shadow / mentor |",
      "| --- | --- | --- | --- |",
      ...rows,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Schedule copied as Markdown.");
    } catch {
      toast.error("Could not access the clipboard. Check your browser permissions.");
    }
  }

  function downloadCsv() {
    const rows = [
      ["Date", "Day", "Standby engineer", "Shadow / mentor"],
      ...assignments.map((assignment) => [
        assignment.date,
        weekday(assignment.date),
        assignment.nameSnapshot,
        (assignment.shadows ?? []).map((shadow) => `${shadow.kind === "TRAINING" ? "Shadow" : "Mentor"}: ${shadow.nameSnapshot}`).join("; "),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadText(`\uFEFF${csv}`, `${filename}.csv`, "text/csv");
    toast.success("CSV schedule exported.");
  }

  function downloadPng() {
    const svg = buildScheduleSvg({ year, month, version, members, assignments, title });
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(svgUrl);
        toast.error("Could not create the PNG export.");
        return;
      }
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Could not create the PNG export.");
          return;
        }
        downloadBlob(blob, `${filename}.png`);
        toast.success("PNG schedule exported.");
      }, "image/png");
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      toast.error("Could not create the PNG export.");
    };
    image.src = svgUrl;
  }

  return (
    <Menu.Root>
      <Menu.Trigger className={buttonVariants({ variant: "outline" })}>
        Export <ChevronDown aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6}>
          <Menu.Popup className="z-50 min-w-52 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none">
            <Menu.Item
              className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent focus:bg-accent"
              onClick={() => void copyMarkdown()}
            >
              <Clipboard aria-hidden="true" className="size-4 text-muted-foreground" />
              Copy as Markdown
            </Menu.Item>
            <Menu.Item
              className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent focus:bg-accent"
              onClick={downloadPng}
            >
              <FileImage aria-hidden="true" className="size-4 text-muted-foreground" />
              Export PNG
            </Menu.Item>
            <Menu.Item
              className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent focus:bg-accent"
              onClick={downloadCsv}
            >
              <FileSpreadsheet aria-hidden="true" className="size-4 text-muted-foreground" />
              Export CSV
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
