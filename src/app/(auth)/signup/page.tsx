import Link from "next/link";
import type { Metadata } from "next";
import {
  AuthNotice,
  AuthShell,
  TextInput,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth/auth-shell";
import { signInWithGoogle, signUpWithPassword } from "../actions";

export const metadata: Metadata = {
  title: "Start free trial | VendorProof",
  description: "Create a VendorProof workspace for vendor compliance tracking.",
};

export default function SignupPage({
  searchParams,
}: {
  searchParams?: { error?: string; message?: string };
}) {
  return (
    <AuthShell
      eyebrow="Start free trial"
      title="Create your compliance workspace."
      text="Sign up, create your organization, then add the first property in onboarding."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:text-accent/85">
            Log in
          </Link>
        </>
      }
    >
      <AuthNotice error={searchParams?.error} message={searchParams?.message} />

      <form action={signInWithGoogle}>
        <button type="submit" className={secondaryButtonClass}>
          Sign up with Google
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          or
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form action={signUpWithPassword} className="space-y-4">
        <TextInput
          label="Full name"
          name="fullName"
          autoComplete="name"
          placeholder="Jordan Lee"
        />
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
          autoComplete="new-password"
          required
        />
        <button type="submit" className={primaryButtonClass}>
          Create workspace
        </button>
      </form>
    </AuthShell>
  );
}
