"use client";

import { useState } from "react";

export type MemberOption = {
    email: string;
    id: string;
    name: string;
    isActive: boolean;
};

export function MemberPicker({
    members,
    selectedMemberIds = [],
    disabled,
}: {
    members: MemberOption[];
    selectedMemberIds?: string[];
    disabled: boolean;
}) {
    const [includeInactive, setIncludeInactive] = useState(false);
    const [selected, setSelected] = useState(() => new Set(selectedMemberIds));

    return (
        <fieldset className="grid gap-3" disabled={disabled}>
            <legend className="mb-1 text-sm font-medium">Participants</legend>
            {members.some((member) => !member.isActive) ? (
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        className="accent-primary size-4"
                        checked={includeInactive}
                        onChange={(event) =>
                            setIncludeInactive(event.target.checked)
                        }
                    />
                    Include inactive members
                </label>
            ) : null}
            {members.map((member) => (
                <label
                    key={member.id}
                    hidden={
                        !member.isActive &&
                        !includeInactive &&
                        !selected.has(member.id)
                    }
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 [&[hidden]]:hidden"
                >
                    <input
                        className="accent-primary mt-1 size-4"
                        name="memberIds"
                        type="checkbox"
                        value={member.id}
                        checked={selected.has(member.id)}
                        onChange={(event) => {
                            const checked = event.target.checked;
                            setSelected((previous) => {
                                const next = new Set(previous);
                                if (checked) next.add(member.id);
                                else next.delete(member.id);
                                return next;
                            });
                        }}
                    />
                    <span className="grid gap-0.5">
                        <span className="text-sm font-medium">
                            {member.name}
                            {member.isActive ? "" : " · inactive"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            {member.email}
                        </span>
                    </span>
                </label>
            ))}
            {!members.some(
                (member) =>
                    member.isActive ||
                    includeInactive ||
                    selected.has(member.id),
            ) ? (
                <p className="text-muted-foreground text-sm">
                    No active team members to add. Include inactive members to
                    plan a historical month.
                </p>
            ) : null}
        </fieldset>
    );
}
