import { headers } from "next/headers";

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configuredUrl) {
    const url = configuredUrl.startsWith("http")
      ? configuredUrl
      : `https://${configuredUrl}`;
    return url.replace(/\/$/, "");
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
