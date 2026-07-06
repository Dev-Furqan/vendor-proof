import Link from "next/link";
import {
  AuthNotice,
  AuthShell,
  TextInput,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth/auth-shell";
import { signInWithGoogle, signInWithPassword } from "../actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string; message?: string };
}) {
  return (
    <AuthShell
      eyebrow="Log in"
      title="Welcome back."
      text="Access your vendor compliance workspace and keep renewal work moving."
      footer={
        <>
          New to VendorProof?{" "}
          <Link href="/signup" className="font-medium text-accent hover:text-accent/85">
            Start a free trial
          </Link>
        </>
      }
    >
      <AuthNotice error={searchParams?.error} message={searchParams?.message} />

      <form action={signInWithGoogle}>
        <button type="submit" className={secondaryButtonClass}>
          Continue with Google
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          or
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form action={signInWithPassword} className="space-y-4">
        <TextInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
        />
        <TextInput
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <button type="submit" className={primaryButtonClass}>
          Log in
        </button>
      </form>
    </AuthShell>
  );
}
