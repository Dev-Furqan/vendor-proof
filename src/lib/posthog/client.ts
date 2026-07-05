"use client";

import posthog from "posthog-js";

let isInitialized = false;

export function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!isInitialized && typeof window !== "undefined" && key) {
    posthog.init(key, {
      api_host: "https://us.i.posthog.com",
    });
    isInitialized = true;
  }

  return posthog;
}

export { posthog };
