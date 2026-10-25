import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthForm } from "@/components/auth-form";

export const Route = createFileRoute("/login")({ component: Login });

// Email + password sign-in page. Linked from the header's "Sign in" button.
// Keep it only if the site needs accounts; delete this file + the header button
// for a purely public/content site.
function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">Use your email and password.</p>
      <AuthForm onDone={() => navigate({ to: "/" })} />
    </main>
  );
}
