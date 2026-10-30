"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Download, FileUp, Upload } from "lucide-react";
import {
    importCallOuts,
    previewCallOutImport,
} from "@/app/actions/call-out-import";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    CALL_OUT_IMPORT_TEMPLATE,
    type ImportEntry,
} from "@/lib/call-out-import";

export function CallOutImportForm() {
    const [csvText, setCsvText] = useState("");
    const [fileName, setFileName] = useState("");
    const [preview, setPreview] = useState<ImportEntry[] | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [result, setResult] = useState<{
        imported: number;
        skipped: number;
    } | null>(null);
    const [isPreviewing, startPreview] = useTransition();
    const [isSaving, startSave] = useTransition();

    function downloadTemplate() {
        const url = URL.createObjectURL(
            new Blob([CALL_OUT_IMPORT_TEMPLATE], {
                type: "text/csv;charset=utf-8",
            }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "call-out-import-template.csv";
        link.click();
        URL.revokeObjectURL(url);
    }
    async function readFile(file?: File) {
        setPreview(null);
        setErrors([]);
        setResult(null);
        setCsvText("");
        if (!file) {
            setFileName("");
            return;
        }
        setFileName(file.name);
        if (file.size > 256000) {
            setErrors(["The CSV file is too large. Keep it under 256 KB."]);
            return;
        }
        try {
            setCsvText(await file.text());
        } catch {
            setErrors(["Could not read the CSV file."]);
        }
    }
    function handlePreview() {
        setErrors([]);
        setPreview(null);
        startPreview(async () => {
            try {
                const result = await previewCallOutImport(csvText);
                if (result.errors.length) setErrors(result.errors);
                else setPreview(result.entries);
            } catch {
                setErrors(["Could not preview the CSV. Please try again."]);
            }
        });
    }
    function handleSave() {
        if (!preview || isSaving) return;
        setErrors([]);
        startSave(async () => {
            try {
                const response = await importCallOuts(csvText);
                if ("error" in response) {
                    setPreview(null);
                    setErrors([response.error]);
                } else {
                    setResult(response);
                    setCsvText("");
                    setFileName("");
                    setPreview(null);
                }
            } catch {
                setErrors(["Import failed. Please try again."]);
            }
        });
    }
    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload the CSV</CardTitle>
                    <CardDescription>
                        Use one row per call-out. Enter dates and times in
                        Europe/Athens. Replace or remove the example rows before
                        importing.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5">
                    <Button
                        className="w-fit cursor-pointer"
                        onClick={downloadTemplate}
                        type="button"
                        variant="outline"
                    >
                        <Download aria-hidden="true" /> Download template
                    </Button>
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">
                            Call-out CSV
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
                                aria-describedby="call-out-csv-help"
                                className="sr-only"
                                disabled={isPreviewing || isSaving}
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
                            id="call-out-csv-help"
                        >
                            Columns: reason, duty_role, start_athens,
                            end_athens. Maximum 256 KB and 1,000 call-outs.
                            {fileName
                                ? ` Selected file: ${fileName}`
                                : " Select a CSV to preview."}
                        </p>
                        <p className="text-muted-foreground text-xs">
                            Use YYYY-MM-DDTHH:mm for dates and times. Roles:
                            PRIMARY, TRAINEE, MENTOR or SUPPORT. The daily-hours
                            export cannot be imported directly.
                        </p>
                    </div>
                    <Button
                        className="w-fit cursor-pointer"
                        disabled={!csvText || isPreviewing || isSaving}
                        onClick={handlePreview}
                        type="button"
                    >
                        <FileUp aria-hidden="true" />{" "}
                        {isPreviewing ? "Checking CSV…" : "Preview call-outs"}
                    </Button>
                </CardContent>
            </Card>
            {errors.length ? (
                <Alert variant="destructive">
                    <AlertTitle>Import needs attention</AlertTitle>
                    <AlertDescription>
                        <ul className="grid list-disc gap-1 pl-5">
                            {errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            ) : null}
            {result ? (
                <div role="status" className="rounded-lg border p-4 text-sm">
                    Imported {result.imported} call-outs; skipped{" "}
                    {result.skipped} existing entries.{" "}
                    <Link className="text-primary underline" href="/call-outs">
                        View your call-outs
                    </Link>
                </div>
            ) : null}
            {preview ? (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Imported call-outs preview</CardTitle>
                            <CardDescription>
                                {preview.length} call-outs. Hours are rounded up
                                separately for each call-out and calendar day.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid max-h-96 gap-2 overflow-auto">
                                {preview.map((entry, index) => (
                                    <article
                                        key={index}
                                        className="rounded-lg border px-3 py-2 text-sm"
                                    >
                                        <p className="font-medium">
                                            {entry.role} · standby{" "}
                                            {entry.dutyDate}
                                        </p>
                                        <p className="mt-1 whitespace-pre-wrap">
                                            {entry.reason}
                                        </p>
                                        <p className="text-muted-foreground mt-1">
                                            {entry.start.replace("T", " ")} –{" "}
                                            {entry.end.replace("T", " ")}
                                        </p>
                                        <p className="mt-1">
                                            {entry.days
                                                .map(
                                                    (day) =>
                                                        `${day.date}: ${day.roundedHours}h`,
                                                )
                                                .join(" · ")}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Confirm import</CardTitle>
                            <CardDescription>
                                Call-outs are saved to your log. Exact matches
                                already in your log will be skipped. Check that
                                example rows have been removed.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                className="w-fit"
                                disabled={isSaving}
                                onClick={handleSave}
                                type="button"
                            >
                                {isSaving
                                    ? "Saving call-outs…"
                                    : "Save imported call-outs"}
                            </Button>
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
