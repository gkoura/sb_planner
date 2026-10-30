import { Suspense } from "react";
import { UsersRound } from "lucide-react";

import { CreateEngineerForm } from "@/components/users/create-engineer-form";
import { UserStatusForm } from "@/components/users/user-status-form";
import { UserRoleForm } from "@/components/users/user-role-form";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export default function UsersPage() {
    return (
        <Suspense fallback={<UsersFallback />}>
            <UsersContent />
        </Suspense>
    );
}

function UsersFallback() {
    return (
        <div
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
            role="status"
            aria-label="Loading team access"
        >
            <section className="grid gap-4">
                <div className="grid gap-3">
                    <div className="bg-muted h-5 w-28 animate-pulse rounded" />
                    <div className="bg-muted h-9 w-48 animate-pulse rounded" />
                    <div className="bg-muted h-16 animate-pulse rounded" />
                </div>

                <div className="bg-muted h-80 animate-pulse rounded-2xl" />
            </section>

            <div className="bg-muted h-64 animate-pulse rounded-2xl" />
        </div>
    );
}

async function UsersContent() {
    const session = await requireAdmin();

    const users = await prisma.user.findMany({
        orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
        select: {
            email: true,
            id: true,
            name: true,
            role: true,
            isActive: true,
        },
    });

    const engineerCount = users.filter(
        (user) => user.role === "ENGINEER" && user.isActive,
    ).length;

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="grid gap-2">
                <div className="text-muted-foreground flex items-center gap-2">
                    <UsersRound className="size-5" />
                    <span className="text-sm font-medium">Team access</span>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight">
                    Team access
                </h1>

                <p className="text-muted-foreground">
                    {engineerCount} engineer{" "}
                    {engineerCount === 1 ? "account is" : "accounts are"}{" "}
                    active. Admin accounts can opt into each month&apos;s
                    rotation. Admins can manage schedules and team access; this
                    permission is separate from team titles.
                </p>

                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Team members</CardTitle>
                        <CardDescription>
                            Deactivate members who have left to disable sign-in
                            and calendar links and hide them from normal
                            planning. Existing rosters and schedule history are
                            preserved. Reactivated members return as engineers.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <ul className="divide-y">
                            {users.map((user) => (
                                <li
                                    key={user.id}
                                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">
                                            {user.name}

                                            {user.id === session.user.id ? (
                                                <span className="text-muted-foreground ml-2 text-xs font-normal">
                                                    you
                                                </span>
                                            ) : null}
                                        </p>

                                        <p className="text-muted-foreground truncate text-sm">
                                            {user.email}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">
                                            {user.isActive
                                                ? user.role.toLowerCase()
                                                : "inactive"}
                                        </Badge>

                                        {user.id !== session.user.id &&
                                        user.isActive ? (
                                            <UserRoleForm
                                                role={user.role}
                                                userId={user.id}
                                                userName={user.name}
                                            />
                                        ) : null}
                                        {user.id !== session.user.id ? (
                                            <UserStatusForm
                                                userId={user.id}
                                                userName={user.name}
                                                isActive={user.isActive}
                                            />
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </section>

            <Card className="h-fit">
                <CardHeader>
                    <CardTitle>Add engineer</CardTitle>

                    <CardDescription>
                        Create a sign-in for a member of the standby rotation.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <CreateEngineerForm />
                </CardContent>
            </Card>
        </div>
    );
}
