-- Fix admin dossier loading and review updates.
--
-- The public RPC argument must remain named `attempt_id` for PostgREST. Inside
-- PL/pgSQL, qualify it with the function name so it cannot be confused with the
-- `attempt_id` column on private.diagnostic_attempt_reviews.

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
    'review', jsonb_build_object(
      'status', coalesce(r.status, 'new'),
      'notes', coalesce(r.notes, ''),
      'reviewedAt', r.reviewed_at,
      'updatedAt', r.updated_at
    )
  ) into output
  from private.diagnostic_attempts a
  left join private.diagnostic_attempt_reviews r on r.attempt_id = a.id
  where a.id = admin_get_diagnostic_attempt.attempt_id;

  if output is null then
    raise exception 'Passation introuvable' using errcode = 'P0002';
  end if;

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
  if not exists (
    select 1
    from private.diagnostic_attempts a
    where a.id = admin_update_diagnostic_review.attempt_id
  ) then
    raise exception 'Passation introuvable' using errcode = 'P0002';
  end if;

  insert into private.diagnostic_attempt_reviews (
    attempt_id, status, notes, reviewed_by, reviewed_at, updated_at
  ) values (
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
    reviewed_at = case
      when excluded.status = 'reviewed' then coalesce(private.diagnostic_attempt_reviews.reviewed_at, now())
      else null
    end,
    updated_at = now();

  select jsonb_build_object(
    'attemptId', r.attempt_id,
    'status', r.status,
    'notes', r.notes,
    'reviewedAt', r.reviewed_at,
    'updatedAt', r.updated_at
  ) into output
  from private.diagnostic_attempt_reviews r
  where r.attempt_id = admin_update_diagnostic_review.attempt_id;

  return output;
end;
$$;

revoke all on function public.admin_update_diagnostic_review(uuid, text, text) from public, anon;
grant execute on function public.admin_update_diagnostic_review(uuid, text, text) to authenticated;
