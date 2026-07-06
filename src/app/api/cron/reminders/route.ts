import { NextResponse } from "next/server";
import { sendVendorReminderEmail } from "@/lib/email/vendor-emails";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createVendorPortalInvite } from "@/lib/vendor-portal/tokens";

const reminderDays = [60, 30, 7, 0];

type ReminderRequirement = {
  id: string;
  organization_id: string;
  vendor_id: string;
  name: string;
  expires_at: string;
  status: string;
};

type ReminderVendor = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
};

type ReminderOrganization = {
  id: string;
  name: string;
};

function dateDaysFromNow(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function configuredSiteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (!url) {
    return "http://localhost:3000";
  }

  return (url.startsWith("http") ? url : `https://${url}`).replace(/\/$/, "");
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const expirationDates = reminderDays.map(dateDaysFromNow);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: requirements, error } = await admin
    .from("vendor_requirements")
    .select("id, organization_id, vendor_id, name, expires_at, status")
    .in("expires_at", expirationDates)
    .neq("status", "waived");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (requirements ?? []) as ReminderRequirement[];
  const vendorIds = Array.from(new Set(rows.map((row) => row.vendor_id).filter(Boolean)));
  const organizationIds = Array.from(
    new Set(rows.map((row) => row.organization_id).filter(Boolean)),
  );

  const [vendorsResult, organizationsResult] = await Promise.all([
    vendorIds.length
      ? admin
          .from("vendors")
          .select("id, organization_id, name, email")
          .in("id", vendorIds)
      : Promise.resolve({ data: [] }),
    organizationIds.length
      ? admin.from("organizations").select("id, name").in("id", organizationIds)
      : Promise.resolve({ data: [] }),
  ]);

  const vendors = new Map(
    ((vendorsResult.data ?? []) as ReminderVendor[]).map((vendor) => [
      vendor.id,
      vendor,
    ]),
  );
  const organizations = new Map(
    ((organizationsResult.data ?? []) as ReminderOrganization[]).map((organization) => [
      organization.id,
      organization,
    ]),
  );

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const requirement of rows) {
    const vendor = vendors.get(requirement.vendor_id);
    const organization = organizations.get(requirement.organization_id);

    if (!vendor?.email || !organization?.name || !requirement.expires_at) {
      skipped += 1;
      continue;
    }

    const daysUntilExpiration = reminderDays.find(
      (days) => dateDaysFromNow(days) === requirement.expires_at,
    );

    if (daysUntilExpiration === undefined) {
      skipped += 1;
      continue;
    }

    const subject = `${requirement.name} ${
      daysUntilExpiration === 0
        ? "expires today"
        : `expires in ${daysUntilExpiration} days`
    }`;

    const { count } = await admin
      .from("communications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", requirement.organization_id)
      .eq("vendor_id", requirement.vendor_id)
      .eq("subject", subject)
      .gte("sent_at", todayStart.toISOString());

    if ((count ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    try {
      const { token } = await createVendorPortalInvite({
        organizationId: requirement.organization_id as string,
        vendorId: requirement.vendor_id,
        email: vendor.email,
        expiresInDays: 14,
      });
      const portalUrl = `${configuredSiteUrl()}/vendor/${token}`;
      const { error: emailError } = await sendVendorReminderEmail({
        to: vendor.email,
        vendorName: vendor.name,
        organizationName: organization.name,
        portalUrl,
        requirementName: requirement.name,
        daysUntilExpiration,
        expirationDate: requirement.expires_at,
      });

      if (emailError) {
        failures.push(`${vendor.email}: ${emailError.message}`);
        continue;
      }

      await admin.from("communications").insert({
        organization_id: requirement.organization_id,
        vendor_id: requirement.vendor_id,
        channel: "email",
        direction: "outbound",
        subject,
        body: `Automated reminder sent for ${requirement.name}. Secure portal link expires in 14 days.`,
        sent_at: new Date().toISOString(),
      });

      await admin
        .from("reminder_schedules")
        .upsert(
          {
            organization_id: requirement.organization_id,
            vendor_requirement_id: requirement.id,
            vendor_id: requirement.vendor_id,
            cadence: "once",
            starts_days_before_expiry: daysUntilExpiration,
            last_sent_at: new Date().toISOString(),
            is_active: false,
          },
          { onConflict: "organization_id,id" },
        )
        .select("id")
        .maybeSingle();

      sent += 1;
    } catch (sendError) {
      failures.push(
        `${vendor.email}: ${
          sendError instanceof Error ? sendError.message : "Unknown reminder error"
        }`,
      );
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    checked: rows.length,
    sent,
    skipped,
    failures,
  });
}
