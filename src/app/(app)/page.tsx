import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth-guard";

export default async function Home() {
  const session = await getCurrentSession();

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <Badge className="w-fit" variant="secondary">
          Standby planning
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {session?.user.name}
        </h1>
        <p className="text-muted-foreground">
          Your team&apos;s monthly standby workspace is being set up.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Next step</CardTitle>
          <CardDescription>
            Add your engineering team, then we&apos;ll create the first planning
            month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session?.user.role === "ADMIN" ? (
            <Button render={<Link href="/admin/users" />}>
              Manage engineers
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              An administrator will create the first planning month.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
