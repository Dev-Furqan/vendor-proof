"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureUserWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const headerStore = headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function authError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signUpWithPassword(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const fullName = getString(formData, "fullName");
  const supabase = createClient();
  const siteUrl = getSiteUrl();

  if (!email || !password) {
    authError("/signup", "Email and password are required.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    authError("/signup", error.message);
  }

  const signedUpUser = data.user;

  if (!signedUpUser) {
    authError("/signup", "Supabase did not return a user for this signup.");
  }

  try {
    await ensureUserWorkspace({
      userId: signedUpUser.id,
      email: signedUpUser.email ?? email,
      fullName,
      avatarUrl: signedUpUser.user_metadata?.avatar_url,
    });
  } catch (workspaceError) {
    authError(
      "/signup",
      workspaceError instanceof Error
        ? workspaceError.message
        : "Could not create your workspace.",
    );
  }

  if (!data.session) {
    redirect(
      "/login?message=" +
        encodeURIComponent("Check your email to confirm your account."),
    );
  }

  redirect("/onboarding");
}

export async function signInWithPassword(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const supabase = createClient();

  if (!email || !password) {
    authError("/login", "Email and password are required.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    authError("/login", error.message);
  }

  if (data.user) {
    try {
      await ensureUserWorkspace({
        userId: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name,
        avatarUrl: data.user.user_metadata?.avatar_url,
      });
    } catch (workspaceError) {
      authError(
        "/login",
        workspaceError instanceof Error
          ? workspaceError.message
          : "Could not load your workspace.",
      );
    }
  }

  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const supabase = createClient();
  const siteUrl = getSiteUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=/onboarding`,
    },
  });

  if (error || !data.url) {
    authError("/login", error?.message ?? "Could not start Google sign in.");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function getCurrentOrganizationId() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !membership?.organization_id) {
    await ensureUserWorkspace({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name,
      avatarUrl: user.user_metadata?.avatar_url,
    });

    const { data: newMembership } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!newMembership?.organization_id) {
      redirect("/onboarding?error=workspace");
    }

    return newMembership.organization_id as string;
  }

  return membership.organization_id as string;
}

export async function saveOrganizationName(formData: FormData) {
  const name = getString(formData, "organizationName");
  const organizationId = await getCurrentOrganizationId();
  const supabase = createClient();

  if (!name) {
    redirect("/onboarding?error=" + encodeURIComponent("Organization name is required."));
  }

  const { error } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", organizationId);

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/onboarding?step=property");
}

export async function addFirstProperty(formData: FormData) {
  const name = getString(formData, "propertyName");
  const addressLine1 = getString(formData, "addressLine1");
  const city = getString(formData, "city");
  const state = getString(formData, "state");
  const postalCode = getString(formData, "postalCode");
  const organizationId = await getCurrentOrganizationId();
  const supabase = createClient();

  if (!name) {
    redirect(
      "/onboarding?step=property&error=" +
        encodeURIComponent("Property name is required."),
    );
  }

  const { error: propertyError } = await supabase.from("properties").insert({
    organization_id: organizationId,
    name,
    address_line1: addressLine1 || null,
    city: city || null,
    state: state || null,
    postal_code: postalCode || null,
  });

  if (propertyError) {
    redirect(
      `/onboarding?step=property&error=${encodeURIComponent(propertyError.message)}`,
    );
  }

  const { error: organizationError } = await supabase
    .from("organizations")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", organizationId);

  if (organizationError) {
    redirect(
      `/onboarding?step=property&error=${encodeURIComponent(organizationError.message)}`,
    );
  }

  redirect("/dashboard");
}
