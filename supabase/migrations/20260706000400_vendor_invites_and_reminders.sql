create table if not exists public.vendor_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null,
  token_hash text not null unique,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint vendor_invites_vendor_fk
    foreign key (organization_id, vendor_id)
    references public.vendors(organization_id, id)
    on delete cascade
);

alter table public.vendor_invites enable row level security;

create policy "vendor_invites_select_org_members" on public.vendor_invites
  for select using (public.is_org_member(organization_id));
create policy "vendor_invites_insert_org_members" on public.vendor_invites
  for insert with check (public.is_org_member(organization_id));
create policy "vendor_invites_update_org_members" on public.vendor_invites
  for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "vendor_invites_delete_org_members" on public.vendor_invites
  for delete using (public.is_org_member(organization_id));

create index if not exists vendor_invites_vendor_id_idx on public.vendor_invites(vendor_id);
create index if not exists vendor_invites_token_hash_idx on public.vendor_invites(token_hash);
create index if not exists vendor_invites_expires_at_idx on public.vendor_invites(expires_at);
