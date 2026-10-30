import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const ui = `import React from '${import.meta.resolve("react")}';
const box = ({ children }) => React.createElement('div', null, children);
export const Card = box, CardContent = box, CardDescription = box, CardHeader = box, CardTitle = box, Badge = box, Select = box, SelectContent = box, SelectItem = box, SelectTrigger = box, SelectValue = box;
export function Button({ children, disabled, type }) { return React.createElement('button', { disabled, type }, children); }
export function Textarea({ name, value }) { return React.createElement('textarea', { name, defaultValue: value }); }`;
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "@/app/actions/schedules")
            return {
                url: `data:text/javascript,export async function saveScheduleEdit() {}`,
                shortCircuit: true,
            };
        if (specifier.startsWith("@/components/ui/"))
            return {
                url: `data:text/javascript,${encodeURIComponent(ui)}`,
                shortCircuit: true,
            };
        if (specifier.startsWith("@/")) {
            const base = new URL(
                `../src/${specifier.slice(2)}`,
                import.meta.url,
            );
            return nextResolve(
                `${base.href}${existsSync(new URL(`${base.href}.ts`)) ? ".ts" : ".tsx"}`,
                context,
            );
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url.endsWith(".tsx"))
            return {
                format: "module",
                shortCircuit: true,
                source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
                    compilerOptions: {
                        jsx: ts.JsxEmit.ReactJSX,
                        module: ts.ModuleKind.ESNext,
                    },
                }).outputText,
            };
        return nextLoad(url, context);
    },
});
const { ScheduleEditor } =
    await import("../src/components/schedules/schedule-editor.tsx");
const { ScheduleCalendar } =
    await import("../src/components/schedules/schedule-calendar.tsx");
const { validateScheduleShadows } =
    await import("../src/lib/schedule-edits.ts");
function fixture() {
    const members = ["A", "B", "C", "D"].map((id) => ({
        id,
        name: id,
        roleSnapshot: "ENGINEER",
        mode: "UNAVAILABLE",
        dates: [],
        participationMode: "NORMAL",
    }));
    members.push({
        id: "T",
        name: "Trainee",
        roleSnapshot: "ENGINEER",
        mode: "UNAVAILABLE",
        dates: [],
        participationMode: "TRAINEE",
        shadowDayCount: 1,
    });
    const assignments = Array.from({ length: 28 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, "0")}`,
        planningMemberId: "ABCD"[i % 4],
        nameSnapshot: "ABCD"[i % 4],
        roleSnapshot: "ENGINEER",
        shadows:
            i === 0
                ? [
                      {
                          id: "shadow",
                          kind: "TRAINING",
                          shadowMemberId: "T",
                          nameSnapshot: "Trainee",
                      },
                  ]
                : [],
    }));
    return { members, assignments };
}

test("admin editor and published calendar render the same mobile shadow labels and colors", () => {
    const { members, assignments } = fixture();
    const props = { year: 2026, month: 2, today: "2026-10-31", assignments };
    const editor = renderToStaticMarkup(
        React.createElement(ScheduleEditor, {
            ...props,
            members,
            scheduleRunId: "run",
            isPublished: false,
        }),
    );
    const published = renderToStaticMarkup(
        React.createElement(ScheduleCalendar, {
            ...props,
            members: members.map((member) => ({
                ...member,
                nameSnapshot: member.name,
            })),
        }),
    );
    for (const html of [editor, published]) {
        assert.match(html, /title="Shadow: Trainee"/);
        assert.match(html, /class="sm:hidden">Shadow: T/);
    }
    assert.match(editor, /; Shadow: Trainee, click to edit/);
    assert.match(editor, /Training shadow/);
    assert.match(editor, /1 shadow · 1 duties/);
    assert.match(editor, /name="shadows"[^>]*value="[^>]*TRAINING/);
    assert.match(editor, /Recalculate shadows/);
    const dayColor = /background-color:([^;]+);border-color:([^";]+)/;
    assert.deepEqual(
        editor.match(dayColor)?.slice(1),
        published.match(dayColor)?.slice(1),
    );
});

test("manual shadow validation blocks invalid modes, missing mentors, self-pairs and adjacent work", () => {
    const { members, assignments } = fixture();
    assert.deepEqual(
        validateScheduleShadows(2026, 2, members, assignments, [
            { date: "2026-02-01", kind: "TRAINING", shadowMemberId: "T" },
        ]),
        [],
    );
    for (const shadow of [
        { date: "2026-02-01", kind: "TRAINING", shadowMemberId: "A" },
        { date: "2026-02-01", kind: "MENTORING", shadowMemberId: "T" },
        { date: "2026-03-01", kind: "TRAINING", shadowMemberId: "T" },
    ])
        assert.ok(
            validateScheduleShadows(2026, 2, members, assignments, [shadow])
                .length,
        );
    members[0].participationMode = "MENTORED";
    assert.match(
        validateScheduleShadows(2026, 2, members, assignments, []).join(" "),
        /needs a MENTORING partner/,
    );
    members[0].participationMode = "NORMAL";
    members.at(-1).shadowDayCount = 2;
    const adjacent = [1, 2].map((day) => ({
        date: `2026-02-0${day}`,
        kind: "TRAINING",
        shadowMemberId: "T",
    }));
    assert.match(
        validateScheduleShadows(2026, 2, members, assignments, adjacent).join(
            " ",
        ),
        /consecutive primary or shadow/,
    );
});

test("both shadow participants must be available; an absent submission stays unknown", () => {
    const { members, assignments } = fixture();
    const shadows = [
        { date: "2026-02-01", kind: "TRAINING", shadowMemberId: "T" },
    ];
    members[0].dates = ["2026-02-01"];
    assert.match(
        validateScheduleShadows(2026, 2, members, assignments, shadows).join(
            " ",
        ),
        /A is unavailable/,
    );
    members[0].availabilitySubmitted = false;
    assert.deepEqual(
        validateScheduleShadows(2026, 2, members, assignments, shadows),
        [],
    );
    members.at(-1).dates = ["2026-02-01"];
    assert.match(
        validateScheduleShadows(2026, 2, members, assignments, shadows).join(
            " ",
        ),
        /Trainee is unavailable/,
    );
});
