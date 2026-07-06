"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const HeroVisual = dynamic(() => import("@/components/marketing/hero-visual"), {
  ssr: false,
  loading: () => <HeroVisualSkeleton />,
});

export function HeroVisualSkeleton() {
  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] md:h-[470px]">
      <div className="absolute left-1/2 top-1/2 h-44 w-64 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-md border border-accent/15 bg-accent/5" />
      <div className="absolute left-1/2 top-1/2 h-28 w-52 -translate-x-[42%] -translate-y-[38%] animate-pulse rounded-md border border-white/10 bg-white/5" />
    </div>
  );
}

export function IdleHeroVisual() {
  const [ready, setReady] = useState(false);

  return (
    <div
      className="h-full w-full"
      onPointerEnter={() => setReady(true)}
      onFocus={() => setReady(true)}
      onClick={() => setReady(true)}
      role="presentation"
    >
      {ready ? <HeroVisual /> : <HeroVisualSkeleton />}
    </div>
  );
}
