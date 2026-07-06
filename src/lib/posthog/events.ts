export async function captureServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  try {
    await fetch("https://us.i.posthog.com/capture/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id:
          typeof properties.organization_id === "string"
            ? properties.organization_id
            : "vendorproof-server",
        properties,
      }),
    });
  } catch {
    // Analytics should never block product workflows.
  }
}
