import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";
import { CallOutImportForm } from "@/components/call-outs/import-form";
import { Button } from "@/components/ui/button";

export default function ImportCallOutsPage() {
    return (
        <div className="mx-auto grid w-full max-w-5xl gap-6">
            <Button
                className="w-fit px-0"
                nativeButton={false}
                render={<Link href="/call-outs" />}
                size="sm"
                variant="ghost"
            >
                <ArrowLeft aria-hidden="true" /> Back to call-outs
            </Button>
            <section className="grid gap-3">
                <div className="text-muted-foreground flex items-center gap-2">
                    <FileUp className="size-5" aria-hidden="true" />
                    <span className="text-sm font-medium">Call-out import</span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Import call-outs
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                    Upload a CSV of your call-outs. Review the entries and their
                    elapsed minutes and rounded hours before importing.
                </p>
            </section>
            <CallOutImportForm />
        </div>
    );
}
