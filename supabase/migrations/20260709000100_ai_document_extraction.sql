alter table public.documents
  add column if not exists business_name text,
  add column if not exists policy_number text,
  add column if not exists issuing_authority text,
  add column if not exists ai_extraction_status text not null default 'not_started'
    check (ai_extraction_status in ('not_started', 'disabled', 'pending', 'completed', 'manual_review', 'failed')),
  add column if not exists ai_extraction_model text,
  add column if not exists ai_extraction_raw jsonb,
  add column if not exists ai_extraction_confidence numeric,
  add column if not exists ai_extraction_flags jsonb not null default '[]'::jsonb,
  add column if not exists ai_extraction_usage jsonb,
  add column if not exists ai_extraction_error text,
  add column if not exists ai_extraction_completed_at timestamptz,
  add column if not exists ai_extraction_confirmed_at timestamptz,
  add column if not exists ai_extraction_confirmed_by uuid references public.users(id) on delete set null,
  add column if not exists ai_extraction_corrected_fields jsonb,
  add column if not exists ai_extracted_document_type text,
  add column if not exists ai_extracted_business_name text,
  add column if not exists ai_extracted_policy_number text,
  add column if not exists ai_extracted_effective_date date,
  add column if not exists ai_extracted_expiration_date date,
  add column if not exists ai_extracted_issuing_authority text;

create index if not exists documents_ai_extraction_status_idx
  on public.documents(organization_id, ai_extraction_status);

alter table public.vendor_requirements
  add column if not exists expiration_rule text not null default 'none'
    check (expiration_rule in ('none', 'expires_on_date', 'annual', 'custom'));
