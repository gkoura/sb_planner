import { PhoneCall } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const MR_OPERATORS_PHONE_NUMBER = "2103578130";

export function EmergencyContactCard() {
    return (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm dark:bg-amber-500/10">
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:py-6">
                <div className="flex items-center gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-500 text-amber-950 dark:text-amber-950">
                        <PhoneCall aria-hidden="true" className="size-6" />
                    </span>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">
                            Emergency contact
                        </p>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight">
                            MR Operators
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Call for escalation or other team contact details.
                        </p>
                    </div>
                </div>
                <Button
                    nativeButton={false}
                    render={<a href={`tel:${MR_OPERATORS_PHONE_NUMBER}`} />}
                    variant="outline"
                >
                    <PhoneCall aria-hidden="true" />
                    {MR_OPERATORS_PHONE_NUMBER}
                </Button>
            </CardContent>
        </Card>
    );
}
