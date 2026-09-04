-- AlphaDiagnostic private administrator dashboard.
-- Applied to the Alphaducation Diagnostic Development project on 2026-09-04.

create table if not exists private.diagnostic_admin_invites (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint diagnostic_admin_invites_email_lowercase check (email = lower(email))
);

create table if not exists private.diagnostic_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now(),
  constraint diagnostic_admins_email_lowercase check (email = lower(email))
);

create table if not exists private.diagnostic_attempt_reviews (
  attempt_id uuid primary key references private.diagnostic_attempts(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'in_review', 'reviewed')),
  notes text not null default '' check (char_length(notes) <= 5000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table private.diagnostic_admin_invites enable row level security;
alter table private.diagnostic_admins enable row level security;
alter table private.diagnostic_attempt_reviews enable row level security;
revoke all on table private.diagnostic_admin_invites, private.diagnostic_admins, private.diagnostic_attempt_reviews from public, anon, authenticated;

drop policy if exists "no direct access" on private.diagnostic_admin_invites;
create policy "no direct access" on private.diagnostic_admin_invites for all to anon, authenticated using (false) with check (false);
drop policy if exists "no direct access" on private.diagnostic_admins;
create policy "no direct access" on private.diagnostic_admins for all to anon, authenticated using (false) with check (false);
drop policy if exists "no direct access" on private.diagnostic_attempt_reviews;
create policy "no direct access" on private.diagnostic_attempt_reviews for all to anon, authenticated using (false) with check (false);

create index if not exists diagnostic_attempt_reviews_reviewed_by_idx on private.diagnostic_attempt_reviews(reviewed_by);

-- Add the initial administrator email directly in the private database:
-- insert into private.diagnostic_admin_invites (email)
-- values (lower('<administrator-email>')) on conflict (email) do nothing;

create or replace function private.register_diagnostic_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and exists (
    select 1 from private.diagnostic_admin_invites i where i.email = lower(new.email)
  ) then
    insert into private.diagnostic_admins (user_id, email)
    values (new.id, lower(new.email))
    on conflict (user_id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;
revoke all on function private.register_diagnostic_admin() from public, anon, authenticated;

drop trigger if exists register_diagnostic_admin_after_user_insert on auth.users;
create trigger register_diagnostic_admin_after_user_insert
after insert or update of email on auth.users
for each row execute function private.register_diagnostic_admin();

insert into private.diagnostic_admins (user_id, email)
select u.id, lower(u.email)
from auth.users u
join private.diagnostic_admin_invites i on i.email = lower(u.email)
where u.email is not null
on conflict (user_id) do update set email = excluded.email;

create or replace function public.is_diagnostic_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from private.diagnostic_admins a where a.user_id = auth.uid()
  );
$$;
revoke all on function public.is_diagnostic_admin() from public, anon, authenticated;

create or replace function public.admin_list_diagnostic_attempts(
  search_text text default null,
  status_filter text default null,
  grade_filter text default null,
  limit_count integer default 200
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare output jsonb;
begin
  if not public.is_diagnostic_admin() then
    raise exception 'Accès administrateur requis' using errcode = '42501';
  end if;
  if status_filter is not null and status_filter not in ('new', 'in_review', 'reviewed') then
    raise exception 'Filtre de statut invalide' using errcode = '22023';
  end if;

  with filtered as (
    select a.id, a.student_first_name, a.student_last_name, a.grade,
      a.guardian_contact, a.duration_seconds, a.completed_at, a.result_payload,
      coalesce(r.status, 'new') as review_status, r.updated_at as review_updated_at
    from private.diagnostic_attempts a
    left join private.diagnostic_attempt_reviews r on r.attempt_id = a.id
    where (
      nullif(trim(search_text), '') is null
      or concat_ws(' ', a.student_first_name, a.student_last_name) ilike '%' || trim(search_text) || '%'
      or a.guardian_contact ilike '%' || trim(search_text) || '%'
    )
    and (nullif(grade_filter, '') is null or a.grade = grade_filter)
    and (status_filter is null or coalesce(r.status, 'new') = status_filter)
  ), limited as (
    select * from filtered order by completed_at desc
    limit least(greatest(coalesce(limit_count, 200), 1), 500)
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'studentFirstName', l.student_first_name,
      'studentLastName', l.student_last_name,
      'grade', l.grade,
      'guardianContact', l.guardian_contact,
      'durationSeconds', l.duration_seconds,
      'completedAt', l.completed_at,
      'reviewStatus', l.review_status,
      'reviewUpdatedAt', l.review_updated_at,
      'profileTitle', l.result_payload->>'profileTitle',
      'strengths', coalesce(l.result_payload->'strengths', '[]'::jsonb),
      'priorities', coalesce(l.result_payload->'priorities', '[]'::jsonb),
      'calibration', coalesce(l.result_payload->'calibration', '{}'::jsonb)
    ) order by l.completed_at desc) from limited l), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'newCount', (select count(*) from filtered where review_status = 'new'),
    'inReviewCount', (select count(*) from filtered where review_status = 'in_review'),
    'reviewedCount', (select count(*) from filtered where review_status = 'reviewed'),
    'averageDurationSeconds', coalesce((select round(avg(duration_seconds)) from filtered where duration_seconds is not null), 0)
  ) into output;
  return output;
end;
$$;
revoke all on function public.admin_list_diagnostic_attempts(text, text, text, integer) from public, anon;
grant execute on function public.admin_list_diagnostic_attempts(text, text, text, integer) to authenticated;

create or replace function public.admin_get_diagnostic_attempt(attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare output jsonb;
begin
  if not public.is_diagnostic_admin() then
    raise exception 'Accès administrateur requis' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'id', a.id,
    'clientReference', a.client_reference,
    'diagnosticSlug', a.diagnostic_slug,
    'diagnosticVersion', a.diagnostic_version,
    'student', jsonb_build_object('firstName', a.student_first_name, 'lastName', a.student_last_name, 'grade', a.grade),
    'guardian', jsonb_build_object('name', a.guardian_name, 'contact', a.guardian_contact),
    'consentConfirmed', a.consent_confirmed,
    'parentConfirmed', a.parent_confirmed,
    'language', a.language,
    'durationSeconds', a.duration_seconds,
    'completedAt', a.completed_at,
    'responses', a.responses,
    'result', a.result_payload,
    'review', jsonb_build_object('status', coalesce(r.status, 'new'), 'notes', coalesce(r.notes, ''), 'reviewedAt', r.reviewed_at, 'updatedAt', r.updated_at)
  ) into output
  from private.diagnostic_attempts a
  left join private.diagnostic_attempt_reviews r on r.attempt_id = a.id
  -- The joined review table also has an `attempt_id` column, so qualify the
  -- PostgREST RPC argument explicitly to avoid a PL/pgSQL name collision.
  where a.id = admin_get_diagnostic_attempt.attempt_id;
  if output is null then raise exception 'Passation introuvable' using errcode = 'P0002'; end if;
  return output;
end;
$$;
revoke all on function public.admin_get_diagnostic_attempt(uuid) from public, anon;
grant execute on function public.admin_get_diagnostic_attempt(uuid) to authenticated;

create or replace function public.admin_update_diagnostic_review(
  attempt_id uuid,
  review_status text,
  review_notes text default ''
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare output jsonb;
begin
  if not public.is_diagnostic_admin() then
    raise exception 'Accès administrateur requis' using errcode = '42501';
  end if;
  if admin_update_diagnostic_review.review_status not in ('new', 'in_review', 'reviewed') then
    raise exception 'Statut de suivi invalide' using errcode = '22023';
  end if;
  if char_length(coalesce(admin_update_diagnostic_review.review_notes, '')) > 5000 then
    raise exception 'Notes trop longues' using errcode = '22023';
  end if;
  if not exists (select 1 from private.diagnostic_attempts a where a.id = admin_update_diagnostic_review.attempt_id) then
    raise exception 'Passation introuvable' using errcode = 'P0002';
  end if;

  insert into private.diagnostic_attempt_reviews (attempt_id, status, notes, reviewed_by, reviewed_at, updated_at)
  values (
    admin_update_diagnostic_review.attempt_id,
    admin_update_diagnostic_review.review_status,
    coalesce(admin_update_diagnostic_review.review_notes, ''),
    auth.uid(),
    case when admin_update_diagnostic_review.review_status = 'reviewed' then now() else null end,
    now()
  )
  on conflict on constraint diagnostic_attempt_reviews_pkey do update set
    status = excluded.status,
    notes = excluded.notes,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = case when excluded.status = 'reviewed' then coalesce(private.diagnostic_attempt_reviews.reviewed_at, now()) else null end,
    updated_at = now();

  select jsonb_build_object('attemptId', r.attempt_id, 'status', r.status, 'notes', r.notes, 'reviewedAt', r.reviewed_at, 'updatedAt', r.updated_at)
  into output from private.diagnostic_attempt_reviews r
  where r.attempt_id = admin_update_diagnostic_review.attempt_id;
  return output;
end;
$$;
revoke all on function public.admin_update_diagnostic_review(uuid, text, text) from public, anon;
grant execute on function public.admin_update_diagnostic_review(uuid, text, text) to authenticated;
