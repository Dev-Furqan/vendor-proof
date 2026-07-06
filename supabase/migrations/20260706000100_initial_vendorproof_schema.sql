create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled organization',
  slug text unique,
  created_by uuid references auth.users(id) on delete set null,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  invited_email text,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, id)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.requirement_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  applies_to text not null default 'vendor' check (applies_to in ('vendor', 'property_vendor')),
  document_type text not null check (document_type in ('coi', 'license', 'w9', 'other')),
  expires_required boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  default_requirement_template_id uuid,
  name text not null,
  trade text,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint vendors_default_requirement_template_fk
    foreign key (organization_id, default_requirement_template_id)
    references public.requirement_templates(organization_id, id)
    on delete set null (default_requirement_template_id)
);

create table public.vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null,
  name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint vendor_contacts_vendor_fk
    foreign key (organization_id, vendor_id)
    references public.vendors(organization_id, id)
    on delete cascade
);

create table public.vendor_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null,
  property_id uuid,
  requirement_template_id uuid,
  name text not null,
  document_type text not null check (document_type in ('coi', 'license', 'w9', 'other')),
  required boolean not null default true,
  expires_required boolean not null default false,
  status text not null default 'missing' check (status in ('missing', 'pending_review', 'compliant', 'expiring', 'expired', 'waived')),
  due_date date,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint vendor_requirements_vendor_fk
    foreign key (organization_id, vendor_id)
    references public.vendors(organization_id, id)
    on delete cascade,
  constraint vendor_requirements_property_fk
    foreign key (organization_id, property_id)
    references public.properties(organization_id, id)
    on delete set null (property_id),
  constraint vendor_requirements_template_fk
    foreign key (organization_id, requirement_template_id)
    references public.requirement_templates(organization_id, id)
    on delete set null (requirement_template_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null,
  property_id uuid,
  vendor_requirement_id uuid,
  document_type text not null check (document_type in ('coi', 'license', 'w9', 'other')),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'expired', 'archived')),
  issued_at date,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint documents_vendor_fk
    foreign key (organization_id, vendor_id)
    references public.vendors(organization_id, id)
    on delete cascade,
  constraint documents_property_fk
    foreign key (organization_id, property_id)
    references public.properties(organization_id, id)
    on delete set null (property_id),
  constraint documents_requirement_fk
    foreign key (organization_id, vendor_requirement_id)
    references public.vendor_requirements(organization_id, id)
    on delete set null (vendor_requirement_id)
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null,
  version_number integer not null default 1,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (document_id, version_number),
  constraint document_versions_document_fk
    foreign key (organization_id, document_id)
    references public.documents(organization_id, id)
    on delete cascade
);

create table public.document_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null,
  document_version_id uuid not null,
  reviewer_id uuid references public.users(id) on delete set null,
  status text not null check (status in ('approved', 'rejected', 'needs_changes')),
  notes text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint document_reviews_document_fk
    foreign key (organization_id, document_id)
    references public.documents(organization_id, id)
    on delete cascade,
  constraint document_reviews_version_fk
    foreign key (organization_id, document_version_id)
    references public.document_versions(organization_id, id)
    on delete cascade
);

create table public.reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_requirement_id uuid,
  vendor_id uuid,
  document_id uuid,
  cadence text not null default 'weekly' check (cadence in ('once', 'weekly', 'biweekly', 'monthly')),
  starts_days_before_expiry integer not null default 30,
  next_run_at timestamptz,
  last_sent_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint reminder_schedules_requirement_fk
    foreign key (organization_id, vendor_requirement_id)
    references public.vendor_requirements(organization_id, id)
    on delete cascade,
  constraint reminder_schedules_vendor_fk
    foreign key (organization_id, vendor_id)
    references public.vendors(organization_id, id)
    on delete cascade,
  constraint reminder_schedules_document_fk
    foreign key (organization_id, document_id)
    references public.documents(organization_id, id)
    on delete cascade
);

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid,
  vendor_contact_id uuid,
  related_document_id uuid,
  channel text not null default 'email' check (channel in ('email', 'sms', 'phone', 'note')),
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound', 'internal')),
  subject text,
  body text,
  sent_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint communications_vendor_fk
    foreign key (organization_id, vendor_id)
    references public.vendors(organization_id, id)
    on delete set null (vendor_id),
  constraint communications_contact_fk
    foreign key (organization_id, vendor_contact_id)
    references public.vendor_contacts(organization_id, id)
    on delete set null (vendor_contact_id),
  constraint communications_document_fk
    foreign key (organization_id, related_document_id)
    references public.documents(organization_id, id)
    on delete set null (related_document_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid,
  vendor_id uuid,
  assigned_to uuid references public.users(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'canceled')),
  due_date date,
  completed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint tasks_property_fk
    foreign key (organization_id, property_id)
    references public.properties(organization_id, id)
    on delete set null (property_id),
  constraint tasks_vendor_fk
    foreign key (organization_id, vendor_id)
    references public.vendors(organization_id, id)
    on delete set null (vendor_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan text not null default 'starter',
  status text not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid,
  stripe_invoice_id text unique,
  status text not null default 'draft',
  amount_due integer not null default 0,
  amount_paid integer not null default 0,
  currency text not null default 'usd',
  due_at timestamptz,
  paid_at timestamptz,
  hosted_invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint invoices_subscription_fk
    foreign key (organization_id, subscription_id)
    references public.subscriptions(organization_id, id)
    on delete set null (subscription_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_table text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.shares_org_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.shares_org_with(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.shares_org_with(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.memberships enable row level security;
alter table public.properties enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_contacts enable row level security;
alter table public.requirement_templates enable row level security;
alter table public.vendor_requirements enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_reviews enable row level security;
alter table public.reminder_schedules enable row level security;
alter table public.communications enable row level security;
alter table public.tasks enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.audit_logs enable row level security;

create policy "organizations_select_members" on public.organizations
for select to authenticated using (public.is_org_member(id));
create policy "organizations_insert_authenticated" on public.organizations
for insert to authenticated with check (created_by = auth.uid());
create policy "organizations_update_members" on public.organizations
for update to authenticated using (public.is_org_member(id)) with check (public.is_org_member(id));
create policy "organizations_delete_members" on public.organizations
for delete to authenticated using (public.is_org_member(id));

create policy "users_select_self_or_org_mates" on public.users
for select to authenticated using (id = auth.uid() or public.shares_org_with(id));
create policy "users_insert_self" on public.users
for insert to authenticated with check (id = auth.uid());
create policy "users_update_self" on public.users
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "memberships_select_org_members" on public.memberships
for select to authenticated using (user_id = auth.uid() or public.is_org_member(organization_id));
create policy "memberships_insert_org_members" on public.memberships
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "memberships_update_org_members" on public.memberships
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "memberships_delete_org_members" on public.memberships
for delete to authenticated using (public.is_org_member(organization_id));

create policy "properties_select_org_members" on public.properties
for select to authenticated using (public.is_org_member(organization_id));
create policy "properties_insert_org_members" on public.properties
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "properties_update_org_members" on public.properties
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "properties_delete_org_members" on public.properties
for delete to authenticated using (public.is_org_member(organization_id));

create policy "vendors_select_org_members" on public.vendors
for select to authenticated using (public.is_org_member(organization_id));
create policy "vendors_insert_org_members" on public.vendors
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "vendors_update_org_members" on public.vendors
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "vendors_delete_org_members" on public.vendors
for delete to authenticated using (public.is_org_member(organization_id));

create policy "vendor_contacts_select_org_members" on public.vendor_contacts
for select to authenticated using (public.is_org_member(organization_id));
create policy "vendor_contacts_insert_org_members" on public.vendor_contacts
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "vendor_contacts_update_org_members" on public.vendor_contacts
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "vendor_contacts_delete_org_members" on public.vendor_contacts
for delete to authenticated using (public.is_org_member(organization_id));

create policy "requirement_templates_select_org_members" on public.requirement_templates
for select to authenticated using (public.is_org_member(organization_id));
create policy "requirement_templates_insert_org_members" on public.requirement_templates
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "requirement_templates_update_org_members" on public.requirement_templates
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "requirement_templates_delete_org_members" on public.requirement_templates
for delete to authenticated using (public.is_org_member(organization_id));

create policy "vendor_requirements_select_org_members" on public.vendor_requirements
for select to authenticated using (public.is_org_member(organization_id));
create policy "vendor_requirements_insert_org_members" on public.vendor_requirements
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "vendor_requirements_update_org_members" on public.vendor_requirements
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "vendor_requirements_delete_org_members" on public.vendor_requirements
for delete to authenticated using (public.is_org_member(organization_id));

create policy "documents_select_org_members" on public.documents
for select to authenticated using (public.is_org_member(organization_id));
create policy "documents_insert_org_members" on public.documents
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "documents_update_org_members" on public.documents
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "documents_delete_org_members" on public.documents
for delete to authenticated using (public.is_org_member(organization_id));

create policy "document_versions_select_org_members" on public.document_versions
for select to authenticated using (public.is_org_member(organization_id));
create policy "document_versions_insert_org_members" on public.document_versions
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "document_versions_update_org_members" on public.document_versions
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "document_versions_delete_org_members" on public.document_versions
for delete to authenticated using (public.is_org_member(organization_id));

create policy "document_reviews_select_org_members" on public.document_reviews
for select to authenticated using (public.is_org_member(organization_id));
create policy "document_reviews_insert_org_members" on public.document_reviews
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "document_reviews_update_org_members" on public.document_reviews
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "document_reviews_delete_org_members" on public.document_reviews
for delete to authenticated using (public.is_org_member(organization_id));

create policy "reminder_schedules_select_org_members" on public.reminder_schedules
for select to authenticated using (public.is_org_member(organization_id));
create policy "reminder_schedules_insert_org_members" on public.reminder_schedules
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "reminder_schedules_update_org_members" on public.reminder_schedules
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "reminder_schedules_delete_org_members" on public.reminder_schedules
for delete to authenticated using (public.is_org_member(organization_id));

create policy "communications_select_org_members" on public.communications
for select to authenticated using (public.is_org_member(organization_id));
create policy "communications_insert_org_members" on public.communications
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "communications_update_org_members" on public.communications
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "communications_delete_org_members" on public.communications
for delete to authenticated using (public.is_org_member(organization_id));

create policy "tasks_select_org_members" on public.tasks
for select to authenticated using (public.is_org_member(organization_id));
create policy "tasks_insert_org_members" on public.tasks
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "tasks_update_org_members" on public.tasks
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "tasks_delete_org_members" on public.tasks
for delete to authenticated using (public.is_org_member(organization_id));

create policy "subscriptions_select_org_members" on public.subscriptions
for select to authenticated using (public.is_org_member(organization_id));
create policy "subscriptions_insert_org_members" on public.subscriptions
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "subscriptions_update_org_members" on public.subscriptions
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "subscriptions_delete_org_members" on public.subscriptions
for delete to authenticated using (public.is_org_member(organization_id));

create policy "invoices_select_org_members" on public.invoices
for select to authenticated using (public.is_org_member(organization_id));
create policy "invoices_insert_org_members" on public.invoices
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "invoices_update_org_members" on public.invoices
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "invoices_delete_org_members" on public.invoices
for delete to authenticated using (public.is_org_member(organization_id));

create policy "audit_logs_select_org_members" on public.audit_logs
for select to authenticated using (public.is_org_member(organization_id));
create policy "audit_logs_insert_org_members" on public.audit_logs
for insert to authenticated with check (public.is_org_member(organization_id));
create policy "audit_logs_update_org_members" on public.audit_logs
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "audit_logs_delete_org_members" on public.audit_logs
for delete to authenticated using (public.is_org_member(organization_id));

create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
for each row execute function public.set_updated_at();
create trigger properties_set_updated_at before update on public.properties
for each row execute function public.set_updated_at();
create trigger vendors_set_updated_at before update on public.vendors
for each row execute function public.set_updated_at();
create trigger vendor_contacts_set_updated_at before update on public.vendor_contacts
for each row execute function public.set_updated_at();
create trigger requirement_templates_set_updated_at before update on public.requirement_templates
for each row execute function public.set_updated_at();
create trigger vendor_requirements_set_updated_at before update on public.vendor_requirements
for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
for each row execute function public.set_updated_at();
create trigger reminder_schedules_set_updated_at before update on public.reminder_schedules
for each row execute function public.set_updated_at();
create trigger communications_set_updated_at before update on public.communications
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

create index organizations_created_by_idx on public.organizations(created_by);
create index users_email_idx on public.users(email);
create index memberships_user_id_idx on public.memberships(user_id);
create index memberships_organization_id_idx on public.memberships(organization_id);
create index properties_organization_id_idx on public.properties(organization_id);
create index vendors_organization_id_idx on public.vendors(organization_id);
create index vendors_status_idx on public.vendors(organization_id, status);
create index vendor_contacts_vendor_id_idx on public.vendor_contacts(vendor_id);
create index requirement_templates_organization_id_idx on public.requirement_templates(organization_id);
create index vendor_requirements_vendor_id_idx on public.vendor_requirements(vendor_id);
create index vendor_requirements_property_id_idx on public.vendor_requirements(property_id);
create index vendor_requirements_status_idx on public.vendor_requirements(organization_id, status);
create index vendor_requirements_due_date_idx on public.vendor_requirements(organization_id, due_date);
create index vendor_requirements_expires_at_idx on public.vendor_requirements(organization_id, expires_at);
create index documents_vendor_id_idx on public.documents(vendor_id);
create index documents_requirement_id_idx on public.documents(vendor_requirement_id);
create index documents_status_idx on public.documents(organization_id, status);
create index documents_expires_at_idx on public.documents(organization_id, expires_at);
create index document_versions_document_id_idx on public.document_versions(document_id);
create index document_reviews_document_id_idx on public.document_reviews(document_id);
create index reminder_schedules_next_run_at_idx on public.reminder_schedules(organization_id, next_run_at) where is_active = true;
create index communications_vendor_id_idx on public.communications(vendor_id);
create index communications_sent_at_idx on public.communications(organization_id, sent_at);
create index tasks_status_idx on public.tasks(organization_id, status);
create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_due_date_idx on public.tasks(organization_id, due_date);
create index subscriptions_organization_id_idx on public.subscriptions(organization_id);
create index invoices_organization_id_idx on public.invoices(organization_id);
create index invoices_subscription_id_idx on public.invoices(subscription_id);
create index audit_logs_organization_id_created_at_idx on public.audit_logs(organization_id, created_at desc);
create index audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
