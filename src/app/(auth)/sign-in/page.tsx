import { SignIn } from "@/components/auth/sign-in";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/25 p-4">
      <div className="grid w-full max-w-sm gap-6">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">SB Planner</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Sign in to your schedule
          </h1>
        </div>
        <SignIn allowSignUp={false} />
      </div>
    </main>
  );
}
