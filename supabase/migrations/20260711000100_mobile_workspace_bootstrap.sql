create or replace function public.ensure_user_workspace(
  user_full_name text default null,
  user_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := nullif(auth.jwt() ->> 'email', '');
  workspace_id uuid;
  trial_start_at timestamptz := now();
  trial_end_at timestamptz := now() + interval '14 days';
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  insert into public.users (id, email, full_name, avatar_url)
  values (
    current_user_id,
    current_email,
    nullif(trim(user_full_name), ''),
    nullif(trim(user_avatar_url), '')
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.users.email),
    full_name = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);

  select m.organization_id
  into workspace_id
  from public.memberships m
  where m.user_id = current_user_id
  order by m.created_at asc
  limit 1;

  if workspace_id is not null then
    return workspace_id;
  end if;

  insert into public.organizations (name, created_by)
  values ('Untitled organization', current_user_id)
  returning id into workspace_id;

  insert into public.memberships (organization_id, user_id, role)
  values (workspace_id, current_user_id, 'owner');

  insert into public.subscriptions (
    organization_id,
    plan,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end,
    vendor_limit
  )
  values (
    workspace_id,
    'starter',
    'trialing',
    trial_start_at,
    trial_end_at,
    trial_start_at,
    trial_end_at,
    50
  );

  return workspace_id;
end;
$$;

revoke all on function public.ensure_user_workspace(text, text) from public;
grant execute on function public.ensure_user_workspace(text, text) to authenticated;
