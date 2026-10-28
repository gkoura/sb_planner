"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, RotateCcw, Upload } from "lucide-react";

import {
    importScheduleCsv,
    previewScheduleCsvImport,
    type ScheduleImportPreview,
    type ScheduleImportPreviewResult,
    type ScheduleImportPayload,
} from "@/app/actions/schedule-import";
import { ScheduleCalendar } from "@/components/schedules/schedule-calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ImportMember = {
    id: string;
    nameSnapshot: string;
    emailSnapshot: string;
    roleSnapshot: string;
};

function makeTemplate(year: number, month: number) {
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const rows = ["date,primary_email,shadow_email,shadow_kind"];
    for (let day = 1; day <= dayCount; day += 1) {
        const date =
            String(year) +
            "-" +
            String(month).padStart(2, "0") +
            "-" +
            String(day).padStart(2, "0");
        rows.push(date + ",,,");
    }
    return rows.join("\r\n");
}

export function ScheduleImportForm({
    hasExistingSchedule,
    members,
    month,
    monthLabel,
    planningMonthId,
    today,
    year,
}: {
    hasExistingSchedule: boolean;
    members: ImportMember[];
    month: number;
    monthLabel: string;
    planningMonthId: string;
    today: string;
    year: number;
}) {
    const router = useRouter();
    const [csvText, setCsvText] = useState("");
    const [fileName, setFileName] = useState("");
    const [preview, setPreview] = useState<ScheduleImportPreview | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [reason, setReason] = useState("");
    const [allowPastChanges, setAllowPastChanges] = useState(false);
    const [isPreviewing, startPreview] = useTransition();
    const [isSaving, startSave] = useTransition();

    function downloadTemplate() {
        const content = makeTemplate(year, month);
        const url = URL.createObjectURL(
            new Blob([content], { type: "text/csv;charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download =
            "standby-" +
            year +
            "-" +
            String(month).padStart(2, "0") +
            "-template.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    async function readFile(file?: File) {
        setPreview(null);
        setErrors([]);
        setReason("");
        setAllowPastChanges(false);
        if (!file) {
            setCsvText("");
            setFileName("");
            return;
        }
        if (file.size > 64000) {
            setCsvText("");
            setFileName(file.name);
            setErrors(["The CSV file is too large. Keep it under 64 KB."]);
            return;
        }
        setCsvText(await file.text());
        setFileName(file.name);
    }

    function handlePreview() {
        setErrors([]);
        setPreview(null);
        startPreview(async () => {
            const result: ScheduleImportPreviewResult =
                await previewScheduleCsvImport(planningMonthId, csvText);
            if ("error" in result) {
                setErrors(
                    result.errors?.length ? result.errors : [result.error],
                );
                return;
            }
            setPreview(result.preview);
        });
    }

    const reasonRequired = Boolean(
        preview && (preview.isPublished || preview.warnings.length > 0),
    );
    const canSave = Boolean(
        preview &&
        !isSaving &&
        (!reasonRequired || reason.trim()) &&
        (!preview.isPublished || !preview.hasPastChanges || allowPastChanges),
    );

    function handleSave() {
        if (!preview || !canSave) return;
        const payload: ScheduleImportPayload = {
            planningMonthId,
            csvText,
            revisionReason: reason,
            allowPastChanges,
            expectedCurrentRunId: preview.expectedCurrentRunId,
            expectedStatus: preview.expectedStatus,
        };
        setErrors([]);
        startSave(async () => {
            const result = await importScheduleCsv(payload);
            if ("error" in result) {
                setPreview(null);
                setErrors([result.error]);
                return;
            }
            router.push("/admin/months/" + result.planningMonthId);
            router.refresh();
        });
    }

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload the CSV</CardTitle>
                    <CardDescription>
                        Use one row per day. Primary and shadow participants
                        must already be in the month roster. A shadow kind is
                        TRAINING or MENTORING.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5">
                    <div className="flex flex-wrap gap-3">
                        <Button
                            className="cursor-pointer"
                            onClick={downloadTemplate}
                            type="button"
                            variant="outline"
                        >
                            <Download aria-hidden="true" /> Download{" "}
                            {monthLabel} template
                        </Button>
                        {hasExistingSchedule ? (
                            <p className="text-muted-foreground self-center text-sm">
                                Importing into a month with schedule history
                                creates a new version; earlier versions stay in
                                history.
                            </p>
                        ) : null}
                    </div>
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">
                            Schedule CSV
                        </span>
                        <label
                            title={fileName || "Choose CSV file"}
                            className={buttonVariants({
                                variant: "outline",
                                className:
                                    "focus-within:ring-ring/50 w-fit max-w-full cursor-pointer **:cursor-pointer focus-within:ring-3",
                            })}
                        >
                            <Upload aria-hidden="true" />
                            <span className="max-w-[min(70vw,22rem)] min-w-0 truncate">
                                {fileName || "Choose CSV file"}
                            </span>
                            <Input
                                accept=".csv,text/csv"
                                aria-describedby="schedule-csv-help"
                                className="sr-only"
                                onChange={(event) => {
                                    const input = event.currentTarget;
                                    const file = input.files?.[0];
                                    input.value = "";
                                    void readFile(file);
                                }}
                                type="file"
                            />
                        </label>
                        <p
                            className="text-muted-foreground text-xs"
                            id="schedule-csv-help"
                        >
                            Columns: date, primary_email, shadow_email,
                            shadow_kind. Maximum 64 KB.
                            {fileName
                                ? " Selected file: " + fileName
                                : " Select a CSV to preview."}
                        </p>
                    </div>
                    <Button
                        className="w-fit cursor-pointer"
                        disabled={
                            !csvText || isPreviewing || members.length === 0
                        }
                        onClick={handlePreview}
                        type="button"
                    >
                        <FileUp aria-hidden="true" />{" "}
                        {isPreviewing ? "Checking CSV…" : "Preview schedule"}
                    </Button>
                </CardContent>
            </Card>

            {errors.length ? (
                <Alert variant="destructive">
                    <AlertTitle>Import needs attention</AlertTitle>
                    <AlertDescription>
                        <ul className="grid list-disc gap-1 pl-5">
                            {errors.map((error) => (
                                <li key={error}>{error}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            ) : null}

            {preview ? (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {preview.isPublished
                                    ? "Replacement preview"
                                    : "Imported candidate preview"}
                            </CardTitle>
                            <CardDescription>
                                {preview.isPublished
                                    ? "Saving will publish version " +
                                      preview.nextVersion +
                                      " as the current schedule."
                                    : "Saving will create candidate version " +
                                      preview.nextVersion +
                                      "; publish it from the month review page."}
                                {preview.currentVersion
                                    ? " Current version: " +
                                      preview.currentVersion +
                                      "."
                                    : ""}
                                {" Primary fairness score: " +
                                    preview.fairnessScore +
                                    "."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5">
                            <ScheduleCalendar
                                assignments={preview.assignments}
                                members={members}
                                month={month}
                                today={today}
                                year={year}
                            />
                            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {preview.workloads.map((workload) => (
                                    <li
                                        className="rounded-lg border px-3 py-2 text-sm"
                                        key={workload.memberId}
                                    >
                                        <span className="font-medium">
                                            {workload.name}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {" "}
                                            · {workload.assignedDays} primary
                                            days
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {preview.warnings.length ? (
                                <Alert>
                                    <RotateCcw aria-hidden="true" />
                                    <AlertTitle>Schedule exceptions</AlertTitle>
                                    <AlertDescription>
                                        <ul className="grid list-disc gap-1 pl-5">
                                            {preview.warnings.map((warning) => (
                                                <li key={warning}>{warning}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                    No availability or consecutive-day
                                    exceptions found.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Confirm import</CardTitle>
                            <CardDescription>
                                {reasonRequired
                                    ? "Add a short reason to approve this import. It will appear in version history."
                                    : "The imported schedule will be saved as a new immutable version."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            {preview.isPublished && preview.hasPastChanges ? (
                                <label className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                                    <Checkbox
                                        checked={allowPastChanges}
                                        onCheckedChange={(checked) =>
                                            setAllowPastChanges(
                                                checked === true,
                                            )
                                        }
                                    />
                                    <span>
                                        Allow changes to published dates before
                                        today. This correction will be recorded
                                        in history.
                                    </span>
                                </label>
                            ) : null}
                            {reasonRequired ? (
                                <div className="grid gap-2">
                                    <label
                                        className="text-sm font-medium"
                                        htmlFor="import-reason"
                                    >
                                        Reason
                                    </label>
                                    <Textarea
                                        id="import-reason"
                                        maxLength={500}
                                        onChange={(event) =>
                                            setReason(event.currentTarget.value)
                                        }
                                        placeholder="Why is this schedule being imported or changed?"
                                        value={reason}
                                    />
                                    <p className="text-muted-foreground text-right text-xs">
                                        {reason.length}/500
                                    </p>
                                </div>
                            ) : null}
                            <Button
                                className="w-fit"
                                disabled={!canSave}
                                onClick={handleSave}
                                type="button"
                            >
                                {isSaving
                                    ? "Saving schedule…"
                                    : preview.isPublished
                                      ? "Replace published schedule"
                                      : "Save imported candidate"}
                            </Button>
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
