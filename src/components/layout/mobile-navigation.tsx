"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Menu as MenuIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function MobileNavigation({
    links,
}: {
    links: { href: string; label: string }[];
}) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 640px)");
        const closeOnDesktop = () => {
            if (desktop.matches) setOpen(false);
        };
        desktop.addEventListener("change", closeOnDesktop);
        return () => desktop.removeEventListener("change", closeOnDesktop);
    }, []);

    return (
        <nav aria-label="Mobile navigation" className="block sm:hidden">
            <Menu.Root open={open} onOpenChange={setOpen}>
                <Menu.Trigger
                    openOnHover
                    delay={0}
                    closeDelay={150}
                    aria-label="Open navigation menu"
                    className={`${buttonVariants({ variant: "outline" })} size-11 sm:hidden`}
                >
                    <MenuIcon aria-hidden="true" />
                </Menu.Trigger>
                <Menu.Portal>
                    <Menu.Positioner
                        align="end"
                        sideOffset={8}
                        className="z-50 sm:hidden"
                    >
                        <Menu.Popup className="bg-popover text-popover-foreground max-h-[var(--available-height)] w-64 max-w-[var(--available-width)] overflow-y-auto rounded-xl border p-1.5 shadow-lg outline-none">
                            {links.map((link) => (
                                <Menu.LinkItem
                                    key={link.href}
                                    closeOnClick
                                    render={<Link href={link.href} />}
                                    className="hover:bg-accent focus:bg-accent flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium outline-none"
                                >
                                    {link.label}
                                </Menu.LinkItem>
                            ))}
                        </Menu.Popup>
                    </Menu.Positioner>
                </Menu.Portal>
            </Menu.Root>
        </nav>
    );
}
