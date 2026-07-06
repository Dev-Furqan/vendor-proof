import { NextResponse, type NextRequest } from "next/server";
import { ensureUserWorkspace } from "@/lib/auth/workspace";
import { captureServerEvent } from "@/lib/posthog/events";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const errorDescription =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error_code");
  const requestedNext = requestUrl.searchParams.get("next") ?? "/onboarding";
  const next = requestedNext.startsWith("/") ? requestedNext : "/onboarding";

  if (oauthError) {
    const message = errorDescription
      ? `${oauthError}: ${errorDescription}`
      : oauthError;

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, requestUrl.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/login?error=" +
          encodeURIComponent(
            "Google sign-in did not return an auth code. Check Supabase and Google OAuth redirect URLs.",
          ),
        requestUrl.origin,
      ),
    );
  }

  const supabase = createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(exchangeError.message)}`,
        requestUrl.origin,
      ),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      const organizationId = await ensureUserWorkspace({
        userId: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name ?? user.user_metadata?.name,
        avatarUrl: user.user_metadata?.avatar_url,
      });
      await captureServerEvent("signup_completed", {
        organization_id: organizationId,
        user_id: user.id,
        provider: "google",
      });
    } catch (workspaceError) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(
            workspaceError instanceof Error
              ? workspaceError.message
              : "Could not create your workspace.",
          )}`,
          requestUrl.origin,
        ),
      );
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
