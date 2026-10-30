import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { EditCallOutForm } from "@/components/call-outs/edit-form";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth-guard";
import { athensParts } from "@/lib/call-outs";
import { prisma } from "@/lib/prisma";

export default function EditCallOutPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    return (
        <Suspense
            fallback={
                <p className="text-muted-foreground">Loading call-out…</p>
            }
        >
            <EditContent params={params} />
        </Suspense>
    );
}

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
    const session = await getCurrentSession();
    if (!session) redirect("/sign-in");
    const { id } = await params;
    const entry = await prisma.callOut.findFirst({
        where: { id, userId: session.user.id },
    });
    if (!entry) notFound();
    return (
        <div className="mx-auto grid w-full max-w-2xl gap-6">
            <Button
                className="w-fit px-0"
                nativeButton={false}
                render={<Link href="/call-outs" />}
                size="sm"
                variant="ghost"
            >
                <ArrowLeft aria-hidden="true" /> Back to call-outs
            </Button>
            <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Edit call-out
                </h1>
                <p className="text-muted-foreground mt-2">
                    Update the details of your call-out. Times are in
                    Europe/Athens.
                </p>
            </div>
            <EditCallOutForm
                entry={{
                    id: entry.id,
                    reason: entry.reason,
                    role: entry.role,
                    start: athensParts(entry.startedAt),
                    end: athensParts(entry.endedAt),
                }}
            />
        </div>
    );
}
