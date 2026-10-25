import { UsersRound } from "lucide-react";

import { CreateEngineerForm } from "@/components/users/create-engineer-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { email: true, id: true, name: true, role: true },
  });
  const engineerCount = users.filter((user) => user.role === "ENGINEER").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="grid gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <UsersRound className="size-5" />
          <span className="text-sm font-medium">Team access</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Engineers</h1>
        <p className="text-muted-foreground">
          {engineerCount} of 10 engineer accounts are active. Admin accounts are
          separate and can opt into each month&apos;s rotation.
        </p>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Current accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {users.map((user) => (
                <li className="flex items-center justify-between gap-4 py-3" key={user.id}>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <Badge variant="secondary">{user.role.toLowerCase()}</Badge>
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
