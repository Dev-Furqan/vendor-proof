import Link from "next/link";
import { Check, ChevronRight, ShieldCheck } from "lucide-react";
import { IdleHeroVisual } from "@/components/marketing/idle-hero-visual";
import {
  DashboardPreview,
  FadeUp,
  HowItWorksFlow,
  ProblemCards,
  ReminderStrip,
} from "@/components/marketing/landing-motion";

const navLinks = ["Product", "Workflow", "Pricing", "Customers"];

const pricing = [
  {
    name: "Starter",
    price: "$79",
    description: "For small portfolios getting vendor documents under control.",
    features: ["100 vendors", "COI and W-9 tracking", "Email reminders"],
  },
  {
    name: "Pro",
    price: "$199",
    description: "For growing property teams that need reliable compliance ops.",
    features: [
      "500 vendors",
      "License tracking",
      "Renewal workflows",
      "Priority support",
    ],
    featured: true,
  },
  {
    name: "Business",
    price: "$499",
    description: "For multi-market operators with deeper reporting needs.",
    features: [
      "Unlimited vendors",
      "Custom document rules",
      "Portfolio reporting",
      "Dedicated onboarding",
    ],
  },
];

const logos = ["Northstar", "Harbor Group", "UrbanKey", "SlateWorks", "LeasePoint"];

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <FadeUp className="mx-auto max-w-3xl text-center">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-7 text-muted md:text-lg">{text}</p>
    </FadeUp>
  );
}

export default function MarketingPage() {
  return (
    <main className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full max-w-[100vw] overflow-hidden border-b border-white/10 bg-background/82 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 w-full max-w-7xl min-w-0 items-center justify-between gap-4 px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="flex size-8 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
              <ShieldCheck size={17} strokeWidth={2} />
            </span>
            VendorProof
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="text-sm text-muted transition hover:text-white"
              >
                {link}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm text-muted transition hover:text-white sm:inline"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="shrink-0 rounded-md bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition hover:bg-accent/90 sm:px-4 sm:text-sm"
            >
              <span className="hidden min-[360px]:inline">Start free trial</span>
              <span className="min-[360px]:hidden">Start trial</span>
            </Link>
          </div>
        </nav>
      </header>

      <section id="product" className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-accent/40" />
        <div className="mx-auto grid w-full max-w-7xl min-w-0 items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
          <div className="w-full min-w-0 max-w-3xl">
            <ReminderStrip />
            <FadeUp delay={0.05}>
              <h1 className="mt-7 max-w-full break-words text-[2.55rem] font-semibold leading-[1.08] text-white sm:text-5xl md:text-7xl md:leading-[1.02] lg:text-8xl">
                Never chase a certificate of insurance again.
              </h1>
            </FadeUp>
            <FadeUp delay={0.1}>
              <p className="mt-7 max-w-full text-lg leading-8 text-muted sm:max-w-2xl md:text-xl">
                VendorProof tracks vendor COIs, licenses, and W-9s automatically,
                then sends renewal reminders before coverage, credentials, or tax
                forms fall out of compliance.
              </p>
            </FadeUp>
            <FadeUp delay={0.16}>
              <div className="mt-9 flex w-full max-w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 sm:w-auto"
                >
                  Start free trial
                  <ChevronRight size={16} />
                </Link>
                <Link
                  href="#dashboard"
                  className="inline-flex w-full items-center justify-center rounded-md border border-white/12 px-5 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/[0.04] sm:w-auto"
                >
                  View dashboard
                </Link>
              </div>
            </FadeUp>
          </div>

          <FadeUp delay={0.12} className="relative">
            <div className="absolute inset-6 rounded-full bg-accent/8 blur-3xl" />
            <div className="relative h-[360px] w-full md:h-[470px]">
              <IdleHeroVisual />
            </div>
          </FadeUp>
        </div>
      </section>

      <section className="border-t border-white/10 py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="The problem"
            title="Compliance breaks quietly."
            text="Manual vendor compliance feels manageable until one missing document becomes a blocked job, a failed audit, or a coverage gap."
          />
          <div className="mt-14">
            <ProblemCards />
          </div>
        </div>
      </section>

      <section id="workflow" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="How it works"
            title="A simple flow your team can trust."
            text="VendorProof turns document collection and renewal tracking into a repeatable compliance workflow."
          />
          <div className="mt-16">
            <HowItWorksFlow />
          </div>
        </div>
      </section>

      <section id="dashboard" className="border-y border-white/10 py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[0.72fr_1.28fr]">
            <FadeUp>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-accent">
                Live dashboard
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
                Know which vendors are safe to send on-site.
              </h2>
              <p className="mt-5 text-base leading-7 text-muted md:text-lg">
                See compliant, renewing, and expired vendors in one place. Your
                team gets a clean operating view without opening another
                spreadsheet.
              </p>
            </FadeUp>
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Pricing"
            title="Plans for every portfolio stage."
            text="Start with essential tracking, then scale into richer workflows as your vendor network grows."
          />
          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {pricing.map((tier, index) => (
              <FadeUp key={tier.name} delay={index * 0.06}>
                <article
                  className={`h-full rounded-lg border p-6 ${
                    tier.featured
                      ? "border-accent/45 bg-accent/8 shadow-[0_28px_100px_rgba(34,242,210,0.09)]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-xl font-medium text-white">{tier.name}</h3>
                    {tier.featured ? (
                      <span className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs text-accent">
                        Most popular
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-8 flex items-end gap-1">
                    <span className="text-5xl font-semibold text-white">
                      {tier.price}
                    </span>
                    <span className="pb-2 text-muted">/mo</span>
                  </div>
                  <p className="mt-5 min-h-14 text-sm leading-6 text-muted">
                    {tier.description}
                  </p>
                  <Link
                    href="/signup"
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-medium transition ${
                      tier.featured
                        ? "bg-accent text-accent-foreground hover:bg-accent/90"
                        : "border border-white/12 text-white hover:border-white/25 hover:bg-white/[0.04]"
                    }`}
                  >
                    Start free trial
                  </Link>
                  <ul className="mt-7 space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm text-muted">
                        <Check size={16} className="mt-0.5 text-accent" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      <section id="customers" className="border-y border-white/10 py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <FadeUp>
            <div className="grid gap-6 border-b border-white/10 pb-10 sm:grid-cols-5">
              {logos.map((logo) => (
                <div
                  key={logo}
                  className="flex h-12 items-center justify-center rounded-md border border-white/8 bg-white/[0.025] font-mono text-xs uppercase tracking-[0.18em] text-white/35 grayscale"
                >
                  {logo}
                </div>
              ))}
            </div>
          </FadeUp>
          <FadeUp delay={0.08}>
            <blockquote className="mx-auto mt-12 max-w-3xl text-center text-2xl leading-10 text-white md:text-3xl">
              &ldquo;VendorProof gives our regional managers the confidence to approve
              work orders without hunting through inboxes for the latest
              insurance paperwork.&rdquo;
              <footer className="mt-6 text-sm text-muted">
                Operations Director, 2,400-unit property portfolio
              </footer>
            </blockquote>
          </FadeUp>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-5 text-center lg:px-8">
          <FadeUp>
            <h2 className="text-4xl font-semibold text-white md:text-6xl">
              Put vendor compliance on autopilot.
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted">
              Start tracking COIs, licenses, W-9s, and renewal reminders from one
              focused workspace.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent/90"
              >
                Start free trial
                <ChevronRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md border border-white/12 px-5 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/[0.04]"
              >
                Log in
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 text-sm text-muted md:flex-row md:items-center md:justify-between lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-medium text-white">
            <span className="flex size-7 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
              <ShieldCheck size={15} />
            </span>
            VendorProof
          </Link>
          <div className="flex flex-wrap gap-5">
            <a href="#product" className="hover:text-white">
              Product
            </a>
            <a href="#workflow" className="hover:text-white">
              Workflow
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#customers" className="hover:text-white">
              Customers
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
