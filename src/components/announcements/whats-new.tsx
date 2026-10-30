import { Sparkles } from "lucide-react";
import { dismissAnnouncement } from "@/app/actions/announcements";
import { Button } from "@/components/ui/button";
import { announcements } from "@/lib/announcements";
import { prisma } from "@/lib/prisma";

export async function WhatsNew({ userId }: { userId: string }) {
    const dismissed = await prisma.announcementDismissal.findMany({
        where: {
            userId,
            announcementId: { in: announcements.map((item) => item.id) },
        },
        select: { announcementId: true },
    });
    const dismissedIds = new Set(dismissed.map((item) => item.announcementId));
    const unseen = announcements.filter((item) => !dismissedIds.has(item.id));
    if (!unseen.length) return null;

    return (
        <div className="mb-6 grid gap-3" aria-label="What's new">
            {unseen.map((item) => (
                <section
                    key={item.id}
                    aria-labelledby={`announcement-${item.id}`}
                    className="bg-card grid min-w-0 grid-cols-1 items-start gap-4 rounded-2xl border p-5 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)]"
                >
                    <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                        <Sparkles aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-primary text-xs font-semibold tracking-wide uppercase">
                            What’s new
                        </p>
                        <h2
                            id={`announcement-${item.id}`}
                            className="mt-1 font-semibold"
                        >
                            {item.title}
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {item.description}
                        </p>
                    </div>
                    <form
                        action={dismissAnnouncement}
                        className="flex min-w-0 flex-wrap gap-2 sm:col-start-2"
                    >
                        <input
                            type="hidden"
                            name="announcementId"
                            value={item.id}
                        />
                        <Button type="submit" name="open" value="1" size="sm">
                            {item.linkLabel}
                        </Button>
                        <Button type="submit" variant="ghost" size="sm">
                            Dismiss
                        </Button>
                    </form>
                </section>
            ))}
        </div>
    );
}
