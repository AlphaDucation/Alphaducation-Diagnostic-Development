"use client";
/* The local logo is pre-sized and compressed for the Worker runtime. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, BookOpenCheck, Check, ClipboardCheck, Clock3, FileDown, GraduationCap, LoaderCircle, LockKeyhole, Save, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { AttemptDetail, ReviewStatus, StudyPlanDay } from "@/app/admin/admin-types";
import type { DomainScore } from "@/app/types";

const statusLabels: Record<ReviewStatus, string> = { new: "Nouveau", in_review: "En cours de relecture", reviewed: "Relu et validé" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-LB", { dateStyle: "long", timeZone: "Asia/Beirut" }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  return `${Math.round(seconds / 60)} min`;
}

function defaultSummary(attempt: AttemptDetail) {
  const strengths = attempt.result.strengths.slice(0, 3).map((item) => item.label.toLowerCase());
  const priorities = attempt.result.priorities.slice(0, 3).map((item) => item.label.toLowerCase());
  const opening = `${attempt.student.firstName} présente un profil « ${attempt.result.profileTitle} ».`;
  const support = strengths.length
    ? ` Ses points d’appui actuels concernent ${strengths.join(", ")}.`
    : " Ses acquis doivent encore être consolidés à travers des situations guidées.";
  const focus = priorities.length
    ? ` Les prochaines séances gagneront à cibler en priorité ${priorities.join(", ")}, avec un travail court, régulier et explicite sur les erreurs.`
    : " La priorité est de stabiliser ses méthodes de travail et de maintenir une pratique régulière.";
  return `${opening}${support}${focus} Ce bilan constitue un point de départ pédagogique : il doit être relu avec l’élève et ajusté selon les observations en classe.`;
}

function defaultStudyPlan(attempt: AttemptDetail): StudyPlanDay[] {
  const priorities = attempt.result.priorities;
  const first = priorities[0];
  const second = priorities[1] ?? first;
  const third = priorities[2] ?? second ?? first;
  const label = (item: typeof first, fallback: string) => item?.label ?? fallback;
  const action = (item: typeof first, fallback: string) => item?.action ?? fallback;
  const duration = (item: typeof first, fallback = "20 min") => item?.duration ?? fallback;
  return [
    { day: 1, focus: "Comprendre son bilan", action: "Relire les forces et priorités, puis ouvrir un carnet d’erreurs avec trois colonnes : erreur, explication, correction.", duration: "20 min" },
    { day: 2, focus: label(first, "Priorité mathématique 1"), action: action(first, "Reprendre une notion fragile avec un exemple guidé puis trois exercices courts."), duration: duration(first) },
    { day: 3, focus: "Rappel actif", action: "Fermer le cours et écrire de mémoire les règles, étapes ou exemples essentiels. Vérifier ensuite avec le cahier.", duration: "20 min" },
    { day: 4, focus: label(second, "Priorité mathématique 2"), action: action(second, "Travailler une deuxième compétence prioritaire avec correction expliquée à voix haute."), duration: duration(second) },
    { day: 5, focus: "Entraînement ciblé", action: "Résoudre cinq exercices courts sur les deux premières priorités, sans regarder la correction avant la fin.", duration: "25 min" },
    { day: 6, focus: "Apprendre de ses erreurs", action: "Choisir trois erreurs récentes, expliquer leur cause et refaire chaque question avec une nouvelle stratégie.", duration: "20 min" },
    { day: 7, focus: "Bilan de la semaine 1", action: "Faire un mini-test de dix minutes, corriger avec soin et choisir l’objectif principal de la semaine suivante.", duration: "20 min" },
    { day: 8, focus: label(third, "Priorité mathématique 3"), action: action(third, "Consolider une troisième compétence avec un exemple, un exercice guidé et deux exercices autonomes."), duration: duration(third) },
    { day: 9, focus: "Révision espacée", action: "Reprendre sans le cours les notions des jours 2 et 4, puis vérifier uniquement les points oubliés.", duration: "20 min" },
    { day: 10, focus: "Transfert", action: "Résoudre un problème qui mélange plusieurs notions. Souligner les données utiles et justifier chaque étape.", duration: "25 min" },
    { day: 11, focus: "Gestion du temps", action: "Faire une série courte chronométrée. Passer une question bloquante, puis y revenir après les questions accessibles.", duration: "20 min" },
    { day: 12, focus: "Carnet d’erreurs", action: "Relire le carnet, classer les erreurs par type et refaire deux questions sans aide.", duration: "20 min" },
    { day: 13, focus: "Simulation", action: "Faire un mini-test dans les conditions d’un contrôle, puis noter le niveau de confiance avant la correction.", duration: "30 min" },
    { day: 14, focus: "Bilan final", action: "Comparer le mini-test avec le bilan initial, identifier les progrès et fixer les deux prochains objectifs.", duration: "25 min" },
  ];
}

function ScoreBlock({ title, scores }: { title: string; scores: DomainScore[] }) {
  return <section className="report-card report-score-card">
    <h2><BarChart3 /> {title}</h2>
    <div className="report-score-list">{scores.map((score) => <div className="report-score" key={score.domainCode}>
      <div><strong>{score.label}</strong><span>{score.band}</span></div><b>{Math.round(score.score)}<small>/100</small></b>
      <div className="report-score-track"><span style={{ width: `${Math.max(2, score.score)}%` }} /></div>
    </div>)}</div>
  </section>;
}

export default function ReportEditor({ attemptId }: { attemptId: string }) {
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<ReviewStatus>("new");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [plan, setPlan] = useState<StudyPlanDay[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/auth", { cache: "no-store" })
      .then(async (session) => {
        if (!session.ok) { window.location.assign("/admin"); return null; }
        const response = await fetch(`/api/admin/attempts/${attemptId}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Bilan indisponible.");
        return payload as AttemptDetail;
      })
      .then((loaded) => {
        if (!active || !loaded) return;
        setAttempt(loaded);
        setStatus(loaded.review.status);
        setNotes(loaded.review.notes ?? "");
        setSummary(loaded.review.professionalSummary?.trim() || defaultSummary(loaded));
        setPlan(loaded.review.studyPlan?.length ? loaded.review.studyPlan : defaultStudyPlan(loaded));
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Bilan indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attemptId]);

  const lastUpdate = useMemo(() => attempt?.review.updatedAt ? `Dernière sauvegarde : ${formatDate(attempt.review.updatedAt)}` : "Bilan à personnaliser", [attempt]);

  function updatePlan(index: number, field: keyof StudyPlanDay, value: string) {
    setPlan((current) => current.map((day, dayIndex) => dayIndex === index ? { ...day, [field]: value } : day));
  }

  async function saveReport() {
    if (!attempt) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/admin/attempts/${attempt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes, professionalSummary: summary, studyPlan: plan }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Enregistrement impossible.");
      setAttempt((current) => current ? { ...current, review: { ...current.review, ...payload } } : current);
      setMessage("Bilan enregistré.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="report-state"><LoaderCircle className="animate-spin" /><strong>Préparation du bilan…</strong></main>;
  if (error && !attempt) return <main className="report-state"><ShieldCheck /><strong>{error}</strong><Button variant="outline" asChild><a href="/admin">Retour au suivi</a></Button></main>;
  if (!attempt) return null;

  return <main className="report-shell">
    <header className="report-toolbar">
      <div className="report-toolbar-inner">
        <Button variant="ghost" asChild><a href="/admin"><ArrowLeft /> Suivi des élèves</a></Button>
        <div className="report-toolbar-status"><span>{lastUpdate}</span><NativeSelect aria-label="État du dossier" value={status} onChange={(event) => setStatus(event.target.value as ReviewStatus)}><NativeSelectOption value="new">Nouveau</NativeSelectOption><NativeSelectOption value="in_review">En cours</NativeSelectOption><NativeSelectOption value="reviewed">Relu et validé</NativeSelectOption></NativeSelect></div>
        <div className="report-toolbar-actions"><Button variant="outline" onClick={() => window.print()}><FileDown /> Exporter en PDF</Button><Button className="primary-action" onClick={saveReport} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />} Enregistrer</Button></div>
      </div>
    </header>

    <article className="report-document">
      <header className="report-cover">
        <div className="report-brand"><img src="/brand/alphaducation-mark.png" alt="" /><div><strong>alphaducation</strong><span>Apprendre · Comprendre · Grandir</span></div></div>
        <div className="report-edition">AlphaDiagnostic · {attempt.student.grade}</div>
        <div className="report-cover-copy"><p>Bilan pédagogique personnalisé</p><h1>{attempt.student.firstName}<br />{attempt.student.lastName}</h1><div className="report-profile">{attempt.result.profileTitle}</div></div>
        <dl className="report-meta"><div><dt>Niveau</dt><dd>{attempt.student.grade}</dd></div><div><dt>Passation</dt><dd>{formatDate(attempt.completedAt)}</dd></div><div><dt>Durée</dt><dd>{formatDuration(attempt.durationSeconds)}</dd></div><div><dt>État</dt><dd>{statusLabels[status]}</dd></div></dl>
      </header>

      <section className="report-card report-summary-card">
        <div className="report-section-heading"><div><p>Lecture professionnelle</p><h2>Synthèse pédagogique</h2></div><Sparkles /></div>
        <Textarea aria-label="Synthèse pédagogique" className="report-summary-input screen-only" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={6000} />
        <p className="print-only report-summary-print">{summary}</p>
        <p className="report-edit-hint screen-only">Cette synthèse est modifiable avant l’entretien ou l’export PDF.</p>
      </section>

      <div className="report-two-columns">
        <section className="report-card report-strength-card"><h2><Check /> Points d’appui</h2><div className="report-insight-list">{attempt.result.strengths.length ? attempt.result.strengths.map((item) => <div key={item.domainCode}><span>{Math.round(item.score)}</span><p><strong>{item.label}</strong><small>{item.band}</small></p></div>) : <p>Les points d’appui seront précisés après la relecture pédagogique.</p>}</div></section>
        <section className="report-card report-priority-card"><h2><Target /> Priorités</h2><div className="report-insight-list">{attempt.result.priorities.map((item, index) => <div key={item.domainCode}><span>{index + 1}</span><p><strong>{item.label}</strong><small>{item.title}</small></p></div>)}</div></section>
      </div>

      <div className="report-two-columns report-score-columns"><ScoreBlock title="Mathématiques" scores={attempt.result.mathScores} /><ScoreBlock title="Méthodes d’apprentissage" scores={attempt.result.studyScores} /></div>

      <section className="report-card report-observation-card">
        <div><ClipboardCheck /><p><span>Confiance et performance</span><strong>{attempt.result.calibration.label}</strong><small>Écart moyen : {Math.round(attempt.result.calibration.gap)} points</small></p></div>
        <div><GraduationCap /><p><span>Réactions en situation</span><strong>{Math.round(attempt.result.scenarioScore)}/100</strong><small>Choix face aux situations d’étude et de contrôle</small></p></div>
      </section>

      <section className="report-card report-plan-card">
        <div className="report-section-heading"><div><p>Passer du diagnostic à l’action</p><h2>Plan personnalisé · 14 jours</h2></div><BookOpenCheck /></div>
        <p className="report-plan-intro">Un rythme court et régulier pour consolider les priorités sans surcharger l’élève. Chaque ligne peut être adaptée avant validation.</p>
        <div className="report-plan-grid">{plan.map((item, index) => <div className="report-plan-day" key={item.day}>
          <div className="report-day-number"><span>Jour</span><strong>{item.day}</strong></div>
          <div className="report-plan-fields">
            <Label htmlFor={`focus-${item.day}`}>Objectif</Label><Input id={`focus-${item.day}`} className="screen-only" value={item.focus} onChange={(event) => updatePlan(index, "focus", event.target.value)} maxLength={120} /><strong className="print-only">{item.focus}</strong>
            <Label htmlFor={`action-${item.day}`}>Action</Label><Textarea id={`action-${item.day}`} className="screen-only" value={item.action} onChange={(event) => updatePlan(index, "action", event.target.value)} maxLength={600} /><p className="print-only">{item.action}</p>
          </div>
          <div className="report-plan-duration"><Clock3 /><Input aria-label={`Durée du jour ${item.day}`} className="screen-only" value={item.duration} onChange={(event) => updatePlan(index, "duration", event.target.value)} maxLength={80} /><span className="print-only">{item.duration}</span></div>
        </div>)}</div>
      </section>

      {(attempt.responses.planning ?? []).length > 0 && <section className="report-card report-student-plan">
        <h2><BookOpenCheck /> Ce que l’élève a proposé</h2><p>Cette activité montre comment l’élève organise spontanément trois jours de préparation.</p>
        <div>{attempt.responses.planning?.map((item) => <article key={item.day}><strong>{item.day}</strong><span>{item.text}</span></article>)}</div>
      </section>}

      <section className="report-card report-private-card screen-only">
        <div className="report-section-heading"><div><p>Visible uniquement dans l’espace administrateur</p><h2>Notes privées de suivi</h2></div><LockKeyhole /></div>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} placeholder="Observations pour l’entretien, éléments à vérifier, prochaine action…" />
      </section>

      <footer className="report-footer"><div><img src="/brand/alphaducation-mark.png" alt="" /><strong>alphaducation</strong></div><p>{attempt.result.notice}</p><span>Bilan généré le {formatDate(new Date().toISOString())}</span></footer>
    </article>

    <div className="report-bottom-actions screen-only"><div>{error && <p className="error-message">{error}</p>}{message && <p className="admin-success">{message}</p>}</div><Button variant="outline" onClick={() => window.print()}><FileDown /> Exporter en PDF</Button><Button className="primary-action" onClick={saveReport} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />} Enregistrer le bilan</Button></div>
  </main>;
}
