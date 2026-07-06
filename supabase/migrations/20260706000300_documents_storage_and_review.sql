insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "documents_storage_select_org_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "documents_storage_insert_org_members"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "documents_storage_update_org_members"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and public.is_org_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'documents'
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "documents_storage_delete_org_members"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

alter table public.documents
  add column if not exists latest_document_version_id uuid,
  add column if not exists deficient_at timestamptz,
  add column if not exists approved_at timestamptz;

create index if not exists documents_latest_version_idx on public.documents(latest_document_version_id);
create index if not exists document_reviews_status_idx on public.document_reviews(organization_id, status);
