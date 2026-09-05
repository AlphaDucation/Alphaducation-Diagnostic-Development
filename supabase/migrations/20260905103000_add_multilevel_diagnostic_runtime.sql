create or replace function private.normalize_diagnostic_answer(input_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(
    regexp_replace(
      translate(trim(coalesce(input_text, '')), '−–—×·,²³⁴⁵⁶⁷⁸⁹⁰', '---**.234567890'),
      '[[:space:]]+',
      '',
      'g'
    )
  );
$$;

revoke all on function private.normalize_diagnostic_answer(text) from public, anon, authenticated;

create or replace function public.submit_diagnostic_v2(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  diagnostic_row public.diagnostic_versions%rowtype;
  keys jsonb;
  response_item jsonb;
  item jsonb;
  key_item jsonb;
  key_option jsonb;
  skill jsonb;
  intervention jsonb;
  mode_rule jsonb;
  topic jsonb;
  client_id uuid;
  attempt_id uuid;
  prior_result jsonb;
  item_id text;
  option_id text;
  section_code text;
  skill_id text;
  process_code text;
  topic_id text;
  stream_code text;
  stream_family text;
  coverage_status text;
  answer_text text;
  expected_text text;
  accepted_text text;
  accepted_candidate text;
  normalized_answer text;
  max_points numeric;
  points numeric;
  score_value numeric;
  confidence_value numeric;
  evidence_count integer;
  max_math_items integer;
  math_response_count integer := 0;
  behavior_response_count integer := 0;
  expected_behavior_count integer := 0;
  calibration_count integer := 0;
  calibration_sum numeric := 0;
  calibration_signed_sum numeric := 0;
  math_average numeric := 0;
  study_average numeric := 0;
  calibration_gap numeric := 0;
  calibration_direction numeric := 0;
  state_code text;
  profile_title text;
  seen_items jsonb := '{}'::jsonb;
  skill_points jsonb := '{}'::jsonb;
  skill_max jsonb := '{}'::jsonb;
  skill_count jsonb := '{}'::jsonb;
  behavior_points jsonb := '{}'::jsonb;
  behavior_max jsonb := '{}'::jsonb;
  behavior_count jsonb := '{}'::jsonb;
  process_points jsonb := '{}'::jsonb;
  process_max jsonb := '{}'::jsonb;
  process_count jsonb := '{}'::jsonb;
  misconception_count jsonb := '{}'::jsonb;
  math_scores jsonb := '[]'::jsonb;
  study_scores jsonb := '[]'::jsonb;
  process_profile jsonb := '[]'::jsonb;
  misconception_map jsonb := '[]'::jsonb;
  priority_candidates jsonb := '[]'::jsonb;
  strengths jsonb := '[]'::jsonb;
  priorities jsonb := '[]'::jsonb;
  recommended_plan jsonb := '[]'::jsonb;
  not_assessed_topics jsonb := '[]'::jsonb;
  result jsonb;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Payload invalide';
  end if;
  if octet_length(payload::text) > 120000 then
    raise exception 'Payload trop volumineux';
  end if;
  if coalesce((payload #>> '{student,consentConfirmed}')::boolean, false) is not true
     or coalesce((payload #>> '{student,parentConfirmed}')::boolean, false) is not true then
    raise exception 'Le consentement du responsable est requis';
  end if;
  if coalesce(payload->>'clientReference', '') !~ '^[0-9a-fA-F-]{36}$' then
    raise exception 'Référence de passation invalide';
  end if;
  if nullif(trim(payload #>> '{student,firstName}'), '') is null
     or nullif(trim(payload #>> '{student,lastName}'), '') is null
     or nullif(trim(payload #>> '{student,grade}'), '') is null
     or nullif(trim(payload #>> '{student,guardianName}'), '') is null
     or char_length(trim(coalesce(payload #>> '{student,guardianContact}', ''))) < 3 then
    raise exception 'Informations élève incomplètes';
  end if;

  client_id := (payload->>'clientReference')::uuid;
  select a.result_payload into prior_result
  from private.diagnostic_attempts a
  where a.client_reference = client_id;
  if prior_result is not null then
    return prior_result;
  end if;

  select * into diagnostic_row
  from public.diagnostic_versions d
  where d.slug = payload->>'diagnosticSlug'
    and d.version = coalesce((payload->>'diagnosticVersion')::integer, 1)
    and d.status = 'published';
  if not found or diagnostic_row.content->>'schemaVersion' <> 'alphadiagnostic-bank-v1' then
    raise exception 'Diagnostic indisponible';
  end if;

  select s.scoring into keys
  from private.diagnostic_scoring_keys s
  where s.diagnostic_slug = diagnostic_row.slug
    and s.diagnostic_version = diagnostic_row.version;
  if keys is null or keys->>'schemaVersion' <> 'alphadiagnostic-scoring-v1' then
    raise exception 'Clé de correction indisponible';
  end if;

  select value into mode_rule
  from jsonb_array_elements(diagnostic_row.content #> '{routing,modes}')
  where value->>'assessmentMode' = payload #>> '{routing,mode}'
  limit 1;
  if mode_rule is null then
    raise exception 'Mode de diagnostic invalide';
  end if;
  max_math_items := least(40, greatest(8, coalesce((mode_rule->>'maxMathItems')::integer, 12)));
  stream_code := coalesce(nullif(payload #>> '{routing,stream}', ''), 'ALL');
  stream_family := case
    when stream_code in ('SG', 'SV') then 'SCI'
    when stream_code in ('SE', 'LH') then 'HUM'
    else stream_code
  end;

  select count(*) into expected_behavior_count
  from jsonb_array_elements(diagnostic_row.content->'items') q
  where q->>'section' <> 'math'
    and coalesce(q->>'streamCode', 'ALL') in ('ALL', stream_code, stream_family);

  if jsonb_typeof(coalesce(payload #> '{responses,items}', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(payload #> '{responses,items}', '[]'::jsonb)) < 8
     or jsonb_array_length(coalesce(payload #> '{responses,items}', '[]'::jsonb)) > 80 then
    raise exception 'Réponses incomplètes ou trop nombreuses';
  end if;

  for response_item in
    select value from jsonb_array_elements(payload #> '{responses,items}')
  loop
    item_id := response_item->>'itemId';
    if item_id is null or seen_items ? item_id then
      raise exception 'Item dupliqué ou invalide';
    end if;
    seen_items := seen_items || jsonb_build_object(item_id, true);

    item := null;
    select value into item
    from jsonb_array_elements(diagnostic_row.content->'items')
    where value->>'itemId' = item_id
    limit 1;
    if item is null then
      raise exception 'Item inconnu';
    end if;
    if coalesce(item->>'streamCode', 'ALL') not in ('ALL', stream_code, stream_family) then
      raise exception 'Item incompatible avec la série';
    end if;

    topic_id := item->>'topicId';
    if item->>'taughtTopicRule' = 'current_if_taught' then
      coverage_status := null;
      select value->>'status' into coverage_status
      from jsonb_array_elements(coalesce(payload #> '{routing,topicCoverage}', '[]'::jsonb))
      where value->>'topicId' = topic_id
      limit 1;
      if coverage_status is distinct from 'taught' then
        raise exception 'Un item non enseigné a été présenté';
      end if;
    elsif item->>'taughtTopicRule' = 'optional_probe'
          and coalesce((payload #>> '{routing,includeProbes}')::boolean, false) is not true then
      raise exception 'Probe adaptatif non autorisé';
    end if;

    key_item := null;
    select value into key_item
    from jsonb_array_elements(keys->'itemKeys')
    where value->>'itemId' = item_id
    limit 1;
    if key_item is null then
      raise exception 'Clé d’item indisponible';
    end if;

    section_code := item->>'section';
    skill_id := item->>'skillId';
    process_code := coalesce(item->>'processPrimary', 'non_classe');
    max_points := greatest(1, coalesce((key_item->>'maxPoints')::numeric, (item->>'maxPoints')::numeric, 1));
    points := 0;
    option_id := response_item->>'optionId';

    if option_id is not null then
      key_option := null;
      select value into key_option
      from jsonb_array_elements(keys->'optionKeys')
      where value->>'optionId' = option_id and value->>'itemId' = item_id
      limit 1;
      if key_option is null then
        raise exception 'Option inconnue';
      end if;
      points := least(max_points, greatest(0, coalesce((key_option->>'points')::numeric, 0)));
      if section_code = 'math' and points < max_points and key_option->>'misconceptionCode' is not null then
        misconception_count := jsonb_set(
          misconception_count,
          array[key_option->>'misconceptionCode'],
          to_jsonb(coalesce((misconception_count->>(key_option->>'misconceptionCode'))::integer, 0) + 1),
          true
        );
      end if;
    else
      answer_text := left(coalesce(response_item->>'answer', ''), 1200);
      if trim(answer_text) = '' then raise exception 'Réponse ouverte manquante'; end if;
      normalized_answer := private.normalize_diagnostic_answer(answer_text);
      expected_text := key_item->>'expectedAnswer';
      accepted_text := key_item->>'acceptedAnswers';
      if normalized_answer = private.normalize_diagnostic_answer(expected_text) then
        points := max_points;
      elsif accepted_text is not null then
        for accepted_candidate in select unnest(string_to_array(accepted_text, '|')) loop
          if normalized_answer = private.normalize_diagnostic_answer(accepted_candidate) then
            points := max_points;
            exit;
          end if;
        end loop;
      end if;
    end if;

    if section_code = 'math' then
      math_response_count := math_response_count + 1;
      if skill_id is null then raise exception 'Compétence mathématique absente'; end if;
      skill_points := jsonb_set(skill_points, array[skill_id], to_jsonb(coalesce((skill_points->>skill_id)::numeric, 0) + points), true);
      skill_max := jsonb_set(skill_max, array[skill_id], to_jsonb(coalesce((skill_max->>skill_id)::numeric, 0) + max_points), true);
      skill_count := jsonb_set(skill_count, array[skill_id], to_jsonb(coalesce((skill_count->>skill_id)::integer, 0) + 1), true);
      process_points := jsonb_set(process_points, array[process_code], to_jsonb(coalesce((process_points->>process_code)::numeric, 0) + points), true);
      process_max := jsonb_set(process_max, array[process_code], to_jsonb(coalesce((process_max->>process_code)::numeric, 0) + max_points), true);
      process_count := jsonb_set(process_count, array[process_code], to_jsonb(coalesce((process_count->>process_code)::integer, 0) + 1), true);

      if coalesce(response_item->>'confidence', '') ~ '^[0-9]+([.][0-9]+)?$' then
        confidence_value := least(100, greatest(0, (response_item->>'confidence')::numeric));
        calibration_sum := calibration_sum + abs(confidence_value - (100 * points / max_points));
        calibration_signed_sum := calibration_signed_sum + confidence_value - (100 * points / max_points);
        calibration_count := calibration_count + 1;
      end if;
    else
      behavior_response_count := behavior_response_count + 1;
      behavior_points := jsonb_set(behavior_points, array[section_code], to_jsonb(coalesce((behavior_points->>section_code)::numeric, 0) + points), true);
      behavior_max := jsonb_set(behavior_max, array[section_code], to_jsonb(coalesce((behavior_max->>section_code)::numeric, 0) + 3), true);
      behavior_count := jsonb_set(behavior_count, array[section_code], to_jsonb(coalesce((behavior_count->>section_code)::integer, 0) + 1), true);
    end if;
  end loop;

  -- Some beginning-of-year banks intentionally contain only four to seven
  -- prerequisite gateways. The learner profile items are still all required.
  if math_response_count < least(4, max_math_items) or math_response_count > max_math_items then
    raise exception 'Nombre de questions mathématiques invalide';
  end if;
  if behavior_response_count <> expected_behavior_count then
    raise exception 'Le profil d’apprentissage doit être complété';
  end if;

  for skill_id, evidence_count in select key, value::integer from jsonb_each_text(skill_count)
  loop
    score_value := round(100 * (skill_points->>skill_id)::numeric / nullif((skill_max->>skill_id)::numeric, 0));
    skill := null;
    select value into skill from jsonb_array_elements(keys->'skills') where value->>'skill_id' = skill_id limit 1;
    if evidence_count < 2 then
      state_code := 'INSUFFICIENT_EVIDENCE';
    elsif score_value >= 80 then
      state_code := 'SECURE';
    elsif score_value >= 60 then
      state_code := 'DEVELOPING';
    elsif score_value >= 40 then
      state_code := 'FRAGILE';
    elsif skill->>'process_primary' = 'conceptual_understanding' then
      state_code := 'CONCEPTUAL_WEAKNESS';
    elsif skill->>'process_primary' = 'procedural_fluency' then
      state_code := 'PROCEDURAL_WEAKNESS';
    else
      state_code := 'FRAGILE';
    end if;
    math_scores := math_scores || jsonb_build_array(jsonb_build_object(
      'domainCode', skill_id,
      'module', 'math',
      'label', coalesce(skill->>'skill_fr', skill_id),
      'score', score_value,
      'band', private.score_band(score_value),
      'evidenceCount', evidence_count,
      'stateCode', state_code,
      'topicId', skill->>'topic_id'
    ));
    intervention := null;
    select value into intervention
    from jsonb_array_elements(keys->'interventions')
    where value->>'intervention_id' = skill->>'default_intervention_id'
    limit 1;
    priority_candidates := priority_candidates || jsonb_build_array(jsonb_build_object(
      'domainCode', skill_id,
      'label', coalesce(skill->>'skill_fr', skill_id),
      'score', score_value,
      'title', coalesce(intervention->>'title_fr', 'Consolider cette compétence'),
      'action', coalesce(intervention->>'action_fr', 'Reprendre la notion avec des exemples guidés puis la réévaluer.'),
      'duration', case when intervention->>'duration_days' is null then '7 jours' else intervention->>'duration_days' || ' jours' end,
      'interventionId', intervention->>'intervention_id'
    ));
  end loop;

  for section_code, evidence_count in select key, value::integer from jsonb_each_text(behavior_count)
  loop
    score_value := round(100 * (behavior_points->>section_code)::numeric / nullif((behavior_max->>section_code)::numeric, 0));
    study_scores := study_scores || jsonb_build_array(jsonb_build_object(
      'domainCode', section_code,
      'module', 'study',
      'label', case section_code
        when 'metacognition' then 'Métacognition'
        when 'self_regulation' then 'Organisation et autorégulation'
        when 'learning_strategy' then 'Stratégies d’apprentissage'
        when 'exam_behavior' then 'Comportement en examen'
        when 'math_affect' then 'Confiance et persévérance en mathématiques'
        when 'ai_behavior' then 'Usage de l’intelligence artificielle'
        else section_code end,
      'score', score_value,
      'band', private.score_band(score_value),
      'evidenceCount', evidence_count
    ));
  end loop;

  for process_code, evidence_count in select key, value::integer from jsonb_each_text(process_count)
  loop
    score_value := round(100 * (process_points->>process_code)::numeric / nullif((process_max->>process_code)::numeric, 0));
    process_profile := process_profile || jsonb_build_array(jsonb_build_object(
      'processCode', process_code,
      'score', score_value,
      'evidenceCount', evidence_count,
      'band', private.score_band(score_value)
    ));
  end loop;

  for item_id, evidence_count in select key, value::integer from jsonb_each_text(misconception_count)
  loop
    item := null;
    select value into item from jsonb_array_elements(keys->'misconceptions') where value->>'misconception_code' = item_id limit 1;
    misconception_map := misconception_map || jsonb_build_array(jsonb_build_object(
      'code', item_id,
      'label', coalesce(item->>'label_fr', item_id),
      'evidenceCount', evidence_count,
      'stateCode', case when evidence_count >= 2 then 'MISCONCEPTION_CONFIRMED' else 'MISCONCEPTION_SUSPECTED' end
    ));
  end loop;

  select coalesce(avg((value->>'score')::numeric), 0) into math_average from jsonb_array_elements(math_scores);
  select coalesce(avg((value->>'score')::numeric), 0) into study_average from jsonb_array_elements(study_scores);
  if calibration_count > 0 then
    calibration_gap := round(calibration_sum / calibration_count);
    calibration_direction := round(calibration_signed_sum / calibration_count);
  end if;

  if math_average >= 80 and study_average >= 80 then profile_title := 'Profil solide et autonome';
  elsif math_average < 60 and study_average >= 60 then profile_title := 'Méthodes présentes, bases à consolider';
  elsif math_average >= 60 and study_average < 60 then profile_title := 'Potentiel mathématique à mieux organiser';
  else profile_title := 'Progression à structurer'; end if;

  select coalesce(jsonb_agg(selected.item), '[]'::jsonb) into strengths
  from (
    select jsonb_build_object('domainCode', value->>'domainCode', 'label', value->>'label', 'score', (value->>'score')::numeric, 'band', value->>'band') item
    from jsonb_array_elements(math_scores || study_scores)
    order by (value->>'score')::numeric desc, value->>'domainCode'
    limit 3
  ) selected;

  select coalesce(jsonb_agg(selected.item), '[]'::jsonb) into priorities
  from (
    select value as item
    from jsonb_array_elements(priority_candidates)
    order by (value->>'score')::numeric asc, value->>'domainCode'
    limit 3
  ) selected;

  select coalesce(jsonb_agg(jsonb_build_object(
    'day', (p->>'day_number')::integer,
    'focus', p->>'objective_fr',
    'action', p->>'student_task_fr',
    'duration', (p->>'duration_minutes')::text || ' min',
    'interventionId', p->>'intervention_id'
  ) order by (p->>'day_number')::integer, p->>'intervention_id'), '[]'::jsonb)
  into recommended_plan
  from jsonb_array_elements(keys->'planTemplates') p
  where p->>'intervention_id' in (select value->>'interventionId' from jsonb_array_elements(priorities));

  select coalesce(jsonb_agg(jsonb_build_object(
    'topicId', c->>'topicId',
    'status', c->>'status',
    'label', coalesce((select value->>'topicFr' from jsonb_array_elements(diagnostic_row.content->'curriculumTopics') where value->>'topicId' = c->>'topicId' limit 1), c->>'topicId'),
    'subtopic', (select value->>'subtopicFr' from jsonb_array_elements(diagnostic_row.content->'curriculumTopics') where value->>'topicId' = c->>'topicId' limit 1)
  )), '[]'::jsonb)
  into not_assessed_topics
  from jsonb_array_elements(coalesce(payload #> '{routing,topicCoverage}', '[]'::jsonb)) c
  where c->>'status' <> 'taught';

  result := jsonb_build_object(
    'profileTitle', profile_title,
    'mathScores', math_scores,
    'studyScores', study_scores,
    'scenarioScore', round(study_average),
    'calibration', jsonb_build_object(
      'gap', calibration_gap,
      'direction', calibration_direction,
      'label', case when calibration_gap < 15 then 'Confiance bien calibrée'
        when calibration_direction > 10 then 'Tendance à la surconfiance'
        when calibration_direction < -10 then 'Tendance à la sous-confiance'
        else 'Confiance à mieux calibrer' end
    ),
    'strengths', strengths,
    'priorities', priorities,
    'processProfile', process_profile,
    'misconceptionMap', misconception_map,
    'recommendedPlan', recommended_plan,
    'notAssessedTopics', not_assessed_topics,
    'diagnosticContext', jsonb_build_object(
      'grade', payload #>> '{student,grade}',
      'stream', nullif(stream_code, 'ALL'),
      'mode', payload #>> '{routing,mode}',
      'modeLabel', mode_rule->>'labelFr',
      'assessedMathItems', math_response_count,
      'notAssessedTopicCount', jsonb_array_length(not_assessed_topics)
    ),
    'planningStatus', 'Plan à confirmer avec Vincent ou un tuteur',
    'notice', 'Ce bilan est un point de départ pédagogique. Les chapitres non enseignés ne sont pas comptés comme des erreurs.'
  );

  insert into private.diagnostic_attempts (
    client_reference, diagnostic_slug, diagnostic_version,
    student_first_name, student_last_name, grade,
    guardian_name, guardian_contact, consent_confirmed, parent_confirmed,
    language, duration_seconds, responses, result_payload
  ) values (
    client_id, diagnostic_row.slug, diagnostic_row.version,
    left(trim(payload #>> '{student,firstName}'), 80),
    left(trim(payload #>> '{student,lastName}'), 80),
    left(trim(payload #>> '{student,grade}'), 30),
    left(trim(payload #>> '{student,guardianName}'), 120),
    left(trim(payload #>> '{student,guardianContact}'), 160),
    true, true, 'fr',
    least(14400, greatest(0, coalesce((payload->>'durationSeconds')::integer, 0))),
    jsonb_build_object('routing', payload->'routing', 'items', payload #> '{responses,items}', 'planning', payload #> '{responses,planning}'),
    result
  )
  on conflict (client_reference) do nothing
  returning id into attempt_id;

  if attempt_id is null then
    select a.result_payload into result from private.diagnostic_attempts a where a.client_reference = client_id;
    return result;
  end if;
  result := result || jsonb_build_object('attemptId', attempt_id);
  update private.diagnostic_attempts a set result_payload = result where a.id = attempt_id;
  return result;
end;
$$;

revoke all on function public.submit_diagnostic_v2(jsonb) from public;
grant execute on function public.submit_diagnostic_v2(jsonb) to anon, authenticated;

comment on function public.submit_diagnostic_v2(jsonb) is
  'Validates, scores, and stores a routed Alphaducation multi-level diagnostic. Anonymous execution is intentional; the function exposes no reads and accepts only published versioned banks.';
