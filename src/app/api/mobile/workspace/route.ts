import { NextResponse, type NextRequest } from "next/server";
import { ensureUserWorkspace } from "@/lib/auth/workspace";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers,
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return json({ error: "Missing mobile auth token." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return json({ error: userError?.message ?? "Invalid mobile auth token." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const fullName =
    typeof body.fullName === "string"
      ? body.fullName
      : user.user_metadata?.full_name ?? user.user_metadata?.name;
  const avatarUrl =
    typeof body.avatarUrl === "string"
      ? body.avatarUrl
      : user.user_metadata?.avatar_url;

  try {
    const organizationId = await ensureUserWorkspace({
      userId: user.id,
      email: user.email,
      fullName,
      avatarUrl,
    });

    return json({ organizationId });
  } catch (workspaceError) {
    return json(
      {
        error:
          workspaceError instanceof Error
            ? workspaceError.message
            : "Could not prepare mobile workspace.",
      },
      { status: 500 },
    );
  }
}
