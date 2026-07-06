import { getResend } from "@/lib/email/resend";

const fromEmail = process.env.RESEND_FROM_EMAIL ?? "VendorProof <onboarding@resend.dev>";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendVendorInviteEmail({
  to,
  vendorName,
  organizationName,
  portalUrl,
}: {
  to: string;
  vendorName: string;
  organizationName: string;
  portalUrl: string;
}) {
  return getResend().emails.send({
    from: fromEmail,
    to,
    subject: `${organizationName} requested vendor documents`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;background:#08090b;color:#f7f7f8;padding:28px">
        <div style="max-width:560px;margin:0 auto;border:1px solid #26272b;border-radius:12px;padding:28px;background:#111216">
          <p style="color:#8af0c7;text-transform:uppercase;font-size:12px;letter-spacing:0.14em;margin:0 0 16px">VendorProof</p>
          <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;color:#fff">Document request</h1>
          <p style="color:#b7bbc6;line-height:1.6;margin:0 0 20px">
            ${escapeHtml(organizationName)} needs updated compliance documents from ${escapeHtml(vendorName)}.
            Use the secure link below to upload files. No account is required.
          </p>
          <a href="${portalUrl}" style="display:inline-block;background:#8af0c7;color:#05110d;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 16px">Open upload portal</a>
          <p style="color:#7b8190;font-size:12px;line-height:1.5;margin:22px 0 0">This link is secure and unique to your vendor record.</p>
        </div>
      </div>
    `,
  });
}

export async function sendVendorReminderEmail({
  to,
  vendorName,
  organizationName,
  portalUrl,
  requirementName,
  daysUntilExpiration,
  expirationDate,
}: {
  to: string;
  vendorName: string;
  organizationName: string;
  portalUrl: string;
  requirementName: string;
  daysUntilExpiration: number;
  expirationDate: string;
}) {
  const timing =
    daysUntilExpiration === 0
      ? "expires today"
      : `expires in ${daysUntilExpiration} days`;

  return getResend().emails.send({
    from: fromEmail,
    to,
    subject: `${requirementName} ${timing}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;background:#08090b;color:#f7f7f8;padding:28px">
        <div style="max-width:560px;margin:0 auto;border:1px solid #26272b;border-radius:12px;padding:28px;background:#111216">
          <p style="color:#8af0c7;text-transform:uppercase;font-size:12px;letter-spacing:0.14em;margin:0 0 16px">VendorProof reminder</p>
          <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;color:#fff">${escapeHtml(requirementName)} ${timing}</h1>
          <p style="color:#b7bbc6;line-height:1.6;margin:0 0 20px">
            ${escapeHtml(organizationName)} needs an updated document from ${escapeHtml(vendorName)} by ${escapeHtml(expirationDate)}.
          </p>
          <a href="${portalUrl}" style="display:inline-block;background:#8af0c7;color:#05110d;text-decoration:none;font-weight:700;border-radius:8px;padding:12px 16px">Upload updated document</a>
        </div>
      </div>
    `,
  });
}
