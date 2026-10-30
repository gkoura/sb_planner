"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type MonthGroup = { month: string; count: number; content: ReactNode };

export function CallOutMonthGroups({ groups }: { groups: MonthGroup[] }) {
    const [openMonths, setOpenMonths] = useState<string[]>(() =>
        groups.length ? [groups[0].month] : [],
    );
    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        setOpenMonths(groups.map((group) => group.month))
                    }
                >
                    Expand all
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenMonths([])}
                >
                    Collapse all
                </Button>
            </div>
            {groups.map((group) => {
                const open = openMonths.includes(group.month);
                const [year, month] = group.month.split("-");
                const panelId = `call-outs-${group.month}`;
                return (
                    <section
                        key={group.month}
                        className="bg-card overflow-hidden rounded-2xl border"
                    >
                        <h3>
                            <button
                                type="button"
                                className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center justify-between gap-3 px-5 py-4 text-left focus-visible:ring-2 focus-visible:outline-none"
                                aria-expanded={open}
                                aria-controls={panelId}
                                onClick={() =>
                                    setOpenMonths((current) =>
                                        open
                                            ? current.filter(
                                                  (item) =>
                                                      item !== group.month,
                                              )
                                            : [...current, group.month],
                                    )
                                }
                            >
                                <span className="font-semibold">
                                    {month}-{year}{" "}
                                    <span className="text-muted-foreground ml-2 text-sm font-normal">
                                        {group.count}{" "}
                                        {group.count === 1
                                            ? "call-out"
                                            : "call-outs"}
                                    </span>
                                </span>
                                <ChevronDown
                                    aria-hidden="true"
                                    className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                                />
                            </button>
                        </h3>
                        <div
                            id={panelId}
                            hidden={!open}
                            className={
                                open ? "grid gap-3 border-t p-4" : "hidden"
                            }
                        >
                            {group.content}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
