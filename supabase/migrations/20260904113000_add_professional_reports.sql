-- Store the editable Alphaducation professional report and its 14-day plan.

alter table private.diagnostic_attempt_reviews
  add column if not exists professional_summary text not null default '',
  add column if not exists study_plan jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'diagnostic_attempt_reviews_summary_length') then
    alter table private.diagnostic_attempt_reviews add constraint diagnostic_attempt_reviews_summary_length
      check (char_length(professional_summary) <= 6000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'diagnostic_attempt_reviews_study_plan_shape') then
    alter table private.diagnostic_attempt_reviews add constraint diagnostic_attempt_reviews_study_plan_shape
      check (jsonb_typeof(study_plan) = 'array' and jsonb_array_length(study_plan) <= 14);
  end if;
end;
$$;

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
      'professionalSummary', coalesce(r.professional_summary, ''),
      'studyPlan', coalesce(r.study_plan, '[]'::jsonb),
      'reviewedAt', r.reviewed_at,
      'updatedAt', r.updated_at
    )
  ) into output
  from private.diagnostic_attempts a
  left join private.diagnostic_attempt_reviews r on r.attempt_id = a.id
  where a.id = admin_get_diagnostic_attempt.attempt_id;
  if output is null then raise exception 'Passation introuvable' using errcode = 'P0002'; end if;
  return output;
end;
$$;
revoke all on function public.admin_get_diagnostic_attempt(uuid) from public, anon;
grant execute on function public.admin_get_diagnostic_attempt(uuid) to authenticated;

create or replace function public.admin_save_diagnostic_report(
  p_attempt_id uuid,
  p_status text,
  p_private_notes text default '',
  p_professional_summary text default '',
  p_study_plan jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare output jsonb;
begin
  if not public.is_diagnostic_admin() then
    raise exception 'Accès administrateur requis' using errcode = '42501';
  end if;
  if admin_save_diagnostic_report.p_status not in ('new', 'in_review', 'reviewed') then
    raise exception 'Statut de suivi invalide' using errcode = '22023';
  end if;
  if char_length(coalesce(admin_save_diagnostic_report.p_private_notes, '')) > 5000 then
    raise exception 'Notes trop longues' using errcode = '22023';
  end if;
  if char_length(coalesce(admin_save_diagnostic_report.p_professional_summary, '')) > 6000 then
    raise exception 'Synthèse trop longue' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(admin_save_diagnostic_report.p_study_plan, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(admin_save_diagnostic_report.p_study_plan, '[]'::jsonb)) > 14 then
    raise exception 'Plan de travail invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from private.diagnostic_attempts a where a.id = admin_save_diagnostic_report.p_attempt_id) then
    raise exception 'Passation introuvable' using errcode = 'P0002';
  end if;

  insert into private.diagnostic_attempt_reviews (
    attempt_id, status, notes, professional_summary, study_plan, reviewed_by, reviewed_at, updated_at
  ) values (
    admin_save_diagnostic_report.p_attempt_id,
    admin_save_diagnostic_report.p_status,
    coalesce(admin_save_diagnostic_report.p_private_notes, ''),
    coalesce(admin_save_diagnostic_report.p_professional_summary, ''),
    coalesce(admin_save_diagnostic_report.p_study_plan, '[]'::jsonb),
    auth.uid(),
    case when admin_save_diagnostic_report.p_status = 'reviewed' then now() else null end,
    now()
  )
  on conflict on constraint diagnostic_attempt_reviews_pkey do update set
    status = excluded.status,
    notes = excluded.notes,
    professional_summary = excluded.professional_summary,
    study_plan = excluded.study_plan,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = case when excluded.status = 'reviewed' then coalesce(private.diagnostic_attempt_reviews.reviewed_at, now()) else null end,
    updated_at = now();

  select jsonb_build_object(
    'attemptId', r.attempt_id,
    'status', r.status,
    'notes', r.notes,
    'professionalSummary', r.professional_summary,
    'studyPlan', r.study_plan,
    'reviewedAt', r.reviewed_at,
    'updatedAt', r.updated_at
  ) into output
  from private.diagnostic_attempt_reviews r
  where r.attempt_id = admin_save_diagnostic_report.p_attempt_id;
  return output;
end;
$$;
revoke all on function public.admin_save_diagnostic_report(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.admin_save_diagnostic_report(uuid, text, text, text, jsonb) to authenticated;
