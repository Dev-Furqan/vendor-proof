alter table public.properties
  add column if not exists unit_count integer not null default 0 check (unit_count >= 0),
  add column if not exists property_type text not null default 'multifamily'
    check (property_type in ('residential', 'multifamily', 'HOA', 'commercial'));

alter table public.vendors
  add column if not exists category text;

alter table public.requirement_templates
  add column if not exists requirements jsonb not null default '[]'::jsonb,
  add column if not exists expiration_rule text not null default 'none'
    check (expiration_rule in ('none', 'expires_on_date', 'annual', 'custom'));

create index if not exists properties_type_idx on public.properties(organization_id, property_type);
create index if not exists vendors_category_idx on public.vendors(organization_id, category);
create index if not exists requirement_templates_name_idx on public.requirement_templates(organization_id, name);
