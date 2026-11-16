"use client";

import { Menu } from "@base-ui/react/menu";
import {
    ChevronDown,
    Clipboard,
    FileImage,
    FileSpreadsheet,
    FileText,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

type ExportItem = {
    label: string;
    format: "markdown" | "png" | "csv" | "formatted";
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

const icons = {
    markdown: Clipboard,
    png: FileImage,
    csv: FileSpreadsheet,
    formatted: FileText,
};

const itemClassName =
    "hover:bg-accent focus:bg-accent flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none";

export function ExportMenu({
    items,
    label = "Export",
    buttonText = "Export",
}: {
    items: ExportItem[];
    label?: string;
    buttonText?: string;
}) {
    return (
        <Menu.Root>
            <Menu.Trigger
                aria-label={label}
                className={buttonVariants({ variant: "outline" })}
            >
                {buttonText} <ChevronDown aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
                <Menu.Positioner align="end" sideOffset={6}>
                    <Menu.Popup className="bg-popover text-popover-foreground z-50 min-w-52 rounded-xl border p-1.5 shadow-lg outline-none">
                        {items.map((item) => {
                            const Icon = icons[item.format];
                            const content = (
                                <>
                                    <Icon
                                        aria-hidden="true"
                                        className="text-muted-foreground size-4"
                                    />
                                    {item.label}
                                </>
                            );
                            return item.href !== undefined ? (
                                <Menu.LinkItem
                                    key={item.format}
                                    href={item.href}
                                    closeOnClick
                                    className={itemClassName}
                                >
                                    {content}
                                </Menu.LinkItem>
                            ) : (
                                <Menu.Item
                                    key={item.format}
                                    onClick={item.onClick}
                                    className={itemClassName}
                                >
                                    {content}
                                </Menu.Item>
                            );
                        })}
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.Root>
    );
}
