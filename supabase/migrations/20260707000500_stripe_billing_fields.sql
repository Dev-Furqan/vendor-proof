alter table public.subscriptions
  add column if not exists stripe_price_id text,
  add column if not exists stripe_metered_price_id text,
  add column if not exists trial_start timestamptz,
  add column if not exists trial_end timestamptz,
  add column if not exists vendor_limit integer,
  add column if not exists metered_usage integer not null default 0,
  add column if not exists payment_failed_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.invoices
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists invoice_pdf text;

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions(stripe_customer_id);
create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions(stripe_subscription_id);
create index if not exists subscriptions_trial_end_idx
  on public.subscriptions(organization_id, trial_end);
create index if not exists invoices_stripe_subscription_id_idx
  on public.invoices(stripe_subscription_id);
