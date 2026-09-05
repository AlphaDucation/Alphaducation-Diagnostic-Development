"use client";
/* The local brand assets are optimized for the Worker runtime. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BrainCircuit, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, LoaderCircle, RotateCcw, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { currentTopicGroups, expandTopicCoverage, gradeChoices, routeAssessment, selectCatalogEntry, streamChoices } from "@/app/diagnostic-routing";
import type { AssessmentMode, BankDefinition, BankItem, CatalogEntry, CoverageStatus, GenericResponse, MultilevelDiagnosticResult, RoutedAssessment } from "@/app/multilevel-types";

type Phase = "identity" | "coverage" | "math" | "profile" | "planning" | "result";

const phases: Array<{ key: Phase; short: string; label: string }> = [
  { key: "identity", short: "01", label: "Profil" },
  { key: "coverage", short: "02", label: "Programme" },
  { key: "math", short: "03", label: "Mathématiques" },
  { key: "profile", short: "04", label: "Apprentissage" },
  { key: "planning", short: "05", label: "Mini-plan" },
  { key: "result", short: "06", label: "Bilan" },
];

const coverageLabels: Array<{ code: CoverageStatus; label: string }> = [
  { code: "taught", label: "Étudié" },
  { code: "in_progress", label: "En cours" },
  { code: "not_taught", label: "Pas encore étudié" },
  { code: "unknown", label: "Je ne sais pas" },
];

const sectionLabels: Record<string, string> = {
  metacognition: "Métacognition",
  self_regulation: "Organisation et régularité",
  learning_strategy: "Stratégies d’apprentissage",
  exam_behavior: "Comportement en examen",
  math_affect: "Confiance en mathématiques",
  ai_behavior: "Usage de l’intelligence artificielle",
};

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-lockup ${compact ? "is-compact" : ""}`}>
    <span className="brand-symbol"><img src="/brand/alphaducation-mark.png" alt="" /></span>
    <span className="brand-words"><strong>alphaducation</strong><small>Diagnostic pédagogique</small></span>
  </div>;
}

function ChoiceGrid({ choices, value, onChange }: { choices: Array<{ id: string; text: string }>; value?: string; onChange: (value: string) => void }) {
  return <div className="choice-grid choice-grid-two">{choices.map((choice) => {
    const selected = value === choice.id;
    return <button type="button" key={choice.id} className={`choice-card ${selected ? "is-selected" : ""}`} onClick={() => onChange(choice.id)} aria-pressed={selected}>
      <span className="choice-indicator" aria-hidden="true">{selected && <Check className="size-3.5" strokeWidth={3} />}</span><span>{choice.text}</span>
    </button>;
  })}</div>;
}

function ScoreBar({ score, label, band }: { score: number; label: string; band: string }) {
  return <div className="score-row"><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="font-semibold">{label}</span><span className="whitespace-nowrap text-[var(--muted-foreground)]">{Math.round(score)} · {band}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--aqua-pale)]"><div className="h-full rounded-full bg-[var(--teal)]" style={{ width: `${Math.max(3, score)}%` }} /></div></div>;
}

function Navigation({ message, canBack, onBack, onNext, nextLabel, disabled = false, loading = false }: { message: string; canBack: boolean; onBack: () => void; onNext: () => void; nextLabel: string; disabled?: boolean; loading?: boolean }) {
  return <div className="navigation-row"><div>{message && <p className="error-message" role="alert">{message}</p>}</div><div className="flex items-center gap-3">{canBack && <Button type="button" variant="ghost" size="lg" onClick={onBack}><ArrowLeft /> Précédent</Button>}<Button type="button" className="primary-action" size="lg" onClick={onNext} disabled={disabled}>{loading && <LoaderCircle className="animate-spin" />}{nextLabel}<ChevronRight /></Button></div></div>;
}

function QuestionField({ definition, item, response, onChange }: { definition: BankDefinition; item: BankItem; response?: GenericResponse; onChange: (response: GenericResponse) => void }) {
  const choices = definition.content.options
    .filter((option) => option.itemId === item.itemId)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((option) => ({ id: option.optionId, text: option.optionTextFr }));
  return <div className="space-y-7">
    {choices.length > 0
      ? <ChoiceGrid choices={choices} value={response?.optionId} onChange={(optionId) => onChange({ itemId: item.itemId, optionId, confidence: response?.confidence })} />
      : <div><Label htmlFor={`answer-${item.itemId}`}>Ta réponse{item.responseUnit ? ` (${item.responseUnit})` : ""}</Label><Textarea id={`answer-${item.itemId}`} className="mt-2 min-h-28 resize-none bg-white" value={response?.answer ?? ""} onChange={(event) => onChange({ itemId: item.itemId, answer: event.target.value, confidence: response?.confidence })} placeholder="Écris ta réponse et les étapes utiles…" /></div>}
    {item.confidenceRequired && <div className="confidence-panel"><div><p className="font-bold">Quel est ton niveau de confiance ?</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">Cette réponse aide à distinguer un acquis solide d’un acquis encore fragile.</p></div><div className="confidence-grid">{[
      { value: 25, label: "Peu sûr(e)" }, { value: 50, label: "Plutôt peu sûr(e)" }, { value: 75, label: "Assez sûr(e)" }, { value: 95, label: "Très sûr(e)" },
    ].map((choice) => <button type="button" key={choice.value} className={`confidence-button ${response?.confidence === choice.value ? "is-selected" : ""}`} onClick={() => onChange({ itemId: item.itemId, optionId: response?.optionId, answer: response?.answer, confidence: choice.value })}><strong>{choice.value}%</strong><span>{choice.label}</span></button>)}</div></div>}
  </div>;
}

export default function DiagnosticClient() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [definition, setDefinition] = useState<BankDefinition | null>(null);
  const [routed, setRouted] = useState<RoutedAssessment | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingDefinition, setLoadingDefinition] = useState(false);
  const [phase, setPhase] = useState<Phase>("identity");
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<MultilevelDiagnosticResult | null>(null);
  const startedAt = useRef(0);
  const clientReference = useRef("");
  const [selection, setSelection] = useState<{ grade: string; stream: string; mode: AssessmentMode | "" }>({ grade: "", stream: "ALL", mode: "" });
  const [student, setStudent] = useState({ firstName: "", lastName: "", guardianName: "", guardianContact: "", parentConfirmed: false, consentConfirmed: false });
  const [coverageStatuses, setCoverageStatuses] = useState<Record<string, CoverageStatus>>({});
  const [responses, setResponses] = useState<Record<string, GenericResponse>>({});
  const [planning, setPlanning] = useState(["", "", ""]);

  useEffect(() => {
    startedAt.current = Date.now();
    clientReference.current = crypto.randomUUID();
    fetch("/api/diagnostic/catalog", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Chargement impossible"); return data.items as CatalogEntry[]; })
      .then((items) => { if (!items.length) throw new Error("Aucun diagnostic multi-niveaux n’est publié pour le moment."); setCatalog(items); })
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  const effectiveStream = selection.grade === "S2" || selection.grade === "T" ? selection.stream : "ALL";
  const selectedEntry = useMemo(() => selectCatalogEntry(catalog, selection.grade, effectiveStream), [catalog, selection.grade, effectiveStream]);
  const topicGroups = useMemo(() => definition ? currentTopicGroups(definition, effectiveStream) : [], [definition, effectiveStream]);
  const activePhase = phases.findIndex((item) => item.key === phase);
  const currentItem = phase === "math" ? routed?.mathItems[index] : phase === "profile" ? routed?.profileItems[index] : undefined;
  const progress = useMemo(() => {
    const total = 2 + (routed?.allItems.length ?? 0) + 1;
    let done = phase === "identity" ? 0 : 1;
    if (["math", "profile", "planning", "result"].includes(phase)) done += 1;
    if (["profile", "planning", "result"].includes(phase)) done += routed?.mathItems.length ?? 0; else if (phase === "math") done += index;
    if (["planning", "result"].includes(phase)) done += routed?.profileItems.length ?? 0; else if (phase === "profile") done += index;
    if (phase === "result") done += 1;
    return Math.round((done / Math.max(1, total)) * 100);
  }, [phase, index, routed]);

  const goTo = (next: Phase, nextIndex = 0) => { setMessage(""); setIndex(nextIndex); setPhase(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const needsStream = selection.grade === "S2" || selection.grade === "T";
  const identityReady = Boolean(student.firstName.trim() && student.lastName.trim() && selection.grade && (!needsStream || effectiveStream !== "ALL") && selection.mode && student.guardianName.trim() && student.guardianContact.trim().length >= 3 && student.parentConfirmed && student.consentConfirmed && selectedEntry);

  async function prepareCoverage() {
    if (!identityReady || !selectedEntry) return setMessage("Complète les informations, le niveau, le moment de l’année et les deux confirmations.");
    setLoadingDefinition(true); setMessage("");
    try {
      const response = await fetch(`/api/diagnostic?slug=${encodeURIComponent(selectedEntry.slug)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Chargement impossible");
      const bank = data as BankDefinition;
      const groups = currentTopicGroups(bank, effectiveStream);
      const initialStatus: CoverageStatus = selection.mode === "entry_diagnostic" ? "not_taught" : "unknown";
      setDefinition(bank);
      setCoverageStatuses(Object.fromEntries(groups.map((group) => [group.key, initialStatus])));
      goTo("coverage");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Chargement impossible."); }
    finally { setLoadingDefinition(false); }
  }

  function beginQuestions() {
    if (!definition || !selection.mode) return;
    const coverage = expandTopicCoverage(topicGroups, coverageStatuses);
    const nextRouted = routeAssessment(definition, selection.mode, effectiveStream, coverage);
    if (nextRouted.mathItems.length < 4) return setMessage("Cette banque ne contient pas encore assez de questions admissibles pour ce parcours.");
    setRouted(nextRouted); goTo("math");
  }

  function responseReady(item?: BankItem) {
    if (!item) return false;
    const response = responses[item.itemId];
    const hasAnswer = Boolean(response?.optionId || response?.answer?.trim());
    return hasAnswer && (!item.confidenceRequired || response.confidence !== undefined);
  }

  function nextQuestion() {
    if (!currentItem || !responseReady(currentItem)) return setMessage(currentItem?.confidenceRequired ? "Réponds à la question et indique ton niveau de confiance." : "Choisis la réponse qui te ressemble ou complète ta réponse.");
    setMessage("");
    const items = phase === "math" ? routed!.mathItems : routed!.profileItems;
    if (index < items.length - 1) setIndex(index + 1);
    else goTo(phase === "math" ? "profile" : "planning");
  }

  function previousQuestion() {
    if (index > 0) return setIndex(index - 1);
    if (phase === "math") return goTo("coverage");
    if (phase === "profile") return goTo("math", Math.max(0, (routed?.mathItems.length ?? 1) - 1));
  }

  async function submit() {
    if (!definition || !routed || !selection.mode || planning.some((day) => day.trim().length < 3)) return setMessage("Complète ton action pour chacun des trois jours.");
    setIsSubmitting(true); setMessage("");
    const responseItems = routed.allItems.map((item) => responses[item.itemId]).filter((entry): entry is GenericResponse => Boolean(entry));
    const payload = {
      clientReference: clientReference.current,
      diagnosticSlug: definition.slug,
      diagnosticVersion: definition.version,
      language: "fr" as const,
      durationSeconds: Math.min(14400, Math.max(0, Math.round((Date.now() - startedAt.current) / 1000))),
      student: { ...student, grade: effectiveStream === "ALL" ? selection.grade : `${selection.grade} ${effectiveStream}` },
      routing: { mode: selection.mode, stream: effectiveStream, includeProbes: false, topicCoverage: expandTopicCoverage(topicGroups, coverageStatuses) },
      responses: { items: responseItems, planning: ["Jour 1", "Jour 2", "Jour 3"].map((day, dayIndex) => ({ day, text: planning[dayIndex] })) },
    };
    try {
      const response = await fetch("/api/diagnostic/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Calcul impossible");
      setResult(data as MultilevelDiagnosticResult); goTo("result");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Une erreur est survenue."); }
    finally { setIsSubmitting(false); }
  }

  if (loadError) return <main className="site-shell grid min-h-screen place-items-center px-5"><Card className="state-card"><CardContent className="space-y-5 text-center"><BrandLockup /><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-50 text-[var(--orange)]"><RotateCcw /></div><h1 className="text-2xl font-bold">Les diagnostics sont momentanément indisponibles.</h1><p className="text-[var(--muted-foreground)]">{loadError}</p><Button className="primary-action" onClick={() => window.location.reload()}>Réessayer</Button></CardContent></Card></main>;
  if (!catalog.length) return <main className="site-shell grid min-h-screen place-items-center"><div className="loading-state"><img src="/brand/alphaducation-mark.png" alt="Alphaducation" /><LoaderCircle className="size-6 animate-spin" /><p>Préparation du catalogue…</p></div></main>;

  return <main className={`site-shell phase-${phase} min-h-screen`}>
    <header className="topbar"><div className="topbar-inner"><BrandLockup compact /><div className="topbar-meta"><span className="time-pill"><Clock3 /> {selectedEntry ? `environ ${selectedEntry.estimatedMinutes} min` : "parcours personnalisé"}</span><span className="progress-copy"><strong>{progress}%</strong> complété</span></div></div><Progress value={progress} aria-label={`${progress}% du diagnostic complété`} className="brand-progress h-1 rounded-none bg-transparent [&_[data-slot=progress-indicator]]:bg-[var(--orange)]" /></header>
    <div className="diagnostic-layout">
      <aside className="journey-aside"><div className="journey-panel"><div><p className="journey-kicker">Ton parcours</p><p className="journey-title">Le bon niveau.<br />Le bon diagnostic.</p></div><nav aria-label="Étapes du diagnostic" className="step-nav">{phases.map((item, phaseIndex) => { const done = phaseIndex < activePhase; const active = item.key === phase; return <div key={item.key} className={`step-item ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}><span className="step-number">{done ? <Check className="size-4" /> : item.short}</span><span>{item.label}</span></div>; })}</nav><div className="privacy-note"><ShieldCheck className="size-5" /><p><strong>Données protégées</strong><br />Les chapitres non étudiés ne sont jamais comptés comme des erreurs.</p></div></div></aside>
      <section className="diagnostic-content"><div className="mobile-phase"><span>{phases[activePhase]?.short}</span><p>{phases[activePhase]?.label}</p><strong>{progress}%</strong></div>

        {phase === "identity" && <div className="identity-grid"><section className="identity-hero"><img className="identity-art" src="/brand/learning-path.webp" alt="" /><div className="identity-hero-content"><span className="edition-pill">Grade 6 → Terminale</span><p className="eyebrow">Un diagnostic adapté à ton parcours</p><h1 className="display-title">Comprendre avant de progresser.</h1><p className="lead">L’évaluation choisit les bons prérequis et uniquement les chapitres que tu as réellement étudiés cette année.</p><div className="feature-strip"><span><Target /> Mathématiques ciblées</span><span><BrainCircuit /> Méthodes & confiance</span><span><ClipboardCheck /> Plan personnalisé</span></div></div><div className="identity-manifesto"><span>Comprendre</span><span>Structurer</span><span>Progresser</span></div></section>
          <Card className="form-card"><CardContent className="space-y-7"><div className="form-heading"><span className="form-step">01</span><div><p className="section-kicker">Avant de commencer</p><h2 className="section-title">Construisons ton parcours.</h2><p>Ton niveau et le moment de l’année déterminent les questions proposées.</p></div></div><div className="grid gap-5 sm:grid-cols-2">
            <div><Label htmlFor="firstName">Prénom de l’élève</Label><Input id="firstName" className="field" value={student.firstName} onChange={(event) => setStudent({ ...student, firstName: event.target.value })} /></div><div><Label htmlFor="lastName">Nom de l’élève</Label><Input id="lastName" className="field" value={student.lastName} onChange={(event) => setStudent({ ...student, lastName: event.target.value })} /></div>
            <div><Label htmlFor="grade">Niveau actuel</Label><NativeSelect id="grade" className="field w-full bg-white" value={selection.grade} onChange={(event) => { const grade = event.target.value; setSelection({ grade, stream: grade === "S2" || grade === "T" ? "" : "ALL", mode: "" }); setDefinition(null); }}><NativeSelectOption value="">Choisir le niveau</NativeSelectOption>{gradeChoices.map((choice) => <NativeSelectOption key={choice.code} value={choice.code}>{choice.label}</NativeSelectOption>)}</NativeSelect></div>
            {needsStream && <div><Label htmlFor="stream">Série / branche</Label><NativeSelect id="stream" className="field w-full bg-white" value={selection.stream} onChange={(event) => setSelection({ ...selection, stream: event.target.value, mode: "" })}><NativeSelectOption value="">Choisir la série</NativeSelectOption>{streamChoices[selection.grade].map((choice) => <NativeSelectOption key={choice.code} value={choice.code}>{choice.label}</NativeSelectOption>)}</NativeSelect></div>}
            <div className={needsStream ? "sm:col-span-2" : ""}><Label htmlFor="mode">Quand fais-tu ce diagnostic ?</Label><NativeSelect id="mode" className="field w-full bg-white" value={selection.mode} onChange={(event) => setSelection({ ...selection, mode: event.target.value as AssessmentMode })} disabled={!selectedEntry}><NativeSelectOption value="">Choisir le moment</NativeSelectOption>{(selectedEntry?.modes ?? []).map((mode) => <NativeSelectOption key={mode.assessmentMode} value={mode.assessmentMode}>{mode.labelFr}</NativeSelectOption>)}</NativeSelect>{selection.mode && selectedEntry && <p className="field-help">{selectedEntry.modes.find((mode) => mode.assessmentMode === selection.mode)?.descriptionFr}</p>}</div>
            <div><Label htmlFor="guardianName">Nom du responsable</Label><Input id="guardianName" className="field" value={student.guardianName} onChange={(event) => setStudent({ ...student, guardianName: event.target.value })} /></div><div><Label htmlFor="guardianContact">Téléphone ou e-mail</Label><Input id="guardianContact" className="field" value={student.guardianContact} onChange={(event) => setStudent({ ...student, guardianContact: event.target.value })} /></div>
          </div><div className="consent-box space-y-4"><label className="consent-row"><Checkbox checked={student.parentConfirmed} onCheckedChange={(checked) => setStudent({ ...student, parentConfirmed: checked === true })} /><span>Je confirme être le responsable de l’élève ou avoir son autorisation.</span></label><label className="consent-row"><Checkbox checked={student.consentConfirmed} onCheckedChange={(checked) => setStudent({ ...student, consentConfirmed: checked === true })} /><span>J’accepte l’enregistrement des réponses pour établir et suivre le bilan pédagogique.</span></label></div>{message && <p className="error-message" role="alert">{message}</p>}<Button className="primary-action start-action" size="lg" onClick={prepareCoverage} disabled={loadingDefinition}>{loadingDefinition && <LoaderCircle className="animate-spin" />}Configurer mes chapitres <ArrowLeft className="rotate-180" /></Button></CardContent></Card>
        </div>}

        {phase === "coverage" && definition && <div className="content-stack"><div><p className="section-kicker">Programme réellement étudié</p><h1 className="display-title smaller">Quels chapitres as-tu déjà vus ?</h1><p className="lead">Indique la situation réelle. Les chapitres « en cours », « pas encore étudiés » ou inconnus seront exclus de la note et apparaîtront comme <strong>non évalués</strong>.</p></div><div className="coverage-grid">{topicGroups.map((group, groupIndex) => <Card key={group.key} className={`coverage-card status-${coverageStatuses[group.key] ?? "unknown"}`}><CardContent><div><span>{String(groupIndex + 1).padStart(2, "0")}</span><Label htmlFor={`coverage-${groupIndex}`}>{group.label}</Label></div><NativeSelect id={`coverage-${groupIndex}`} value={coverageStatuses[group.key] ?? "unknown"} onChange={(event) => setCoverageStatuses({ ...coverageStatuses, [group.key]: event.target.value as CoverageStatus })}>{coverageLabels.map((choice) => <NativeSelectOption key={choice.code} value={choice.code}>{choice.label}</NativeSelectOption>)}</NativeSelect></CardContent></Card>)}</div><div className="coverage-note"><ShieldCheck /><p><strong>Aucune pénalité sur les chapitres non étudiés.</strong><br />Le diagnostic conservera les prérequis essentiels de l’année précédente et ajoutera uniquement les chapitres marqués « Étudié ».</p></div><Navigation message={message} canBack onBack={() => goTo("identity")} onNext={beginQuestions} nextLabel="Commencer les questions" /></div>}

        {(phase === "math" || phase === "profile") && definition && routed && currentItem && <div className="content-stack"><div className="question-heading"><div><p className="section-kicker">{phase === "math" ? `Mathématiques · ${currentItem.processPrimary?.replaceAll("_", " ") ?? "raisonnement"}` : sectionLabels[currentItem.section] ?? "Profil d’apprentissage"}</p><h1 className="section-title">{phase === "math" ? `Question ${index + 1} sur ${routed.mathItems.length}` : `Situation ${index + 1} sur ${routed.profileItems.length}`}</h1></div><span className="difficulty-tag">{phase === "math" ? currentItem.difficulty : "Profil"}</span></div><Card className="question-card"><CardContent className="space-y-8"><div>{currentItem.skillId && <p className="question-skill">{currentItem.skillId.replaceAll("-", " ")}</p>}{currentItem.stimulusFr && <p className="question-stimulus">{currentItem.stimulusFr}</p>}<h2 className="question-prompt">{currentItem.promptFr}</h2></div><QuestionField definition={definition} item={currentItem} response={responses[currentItem.itemId]} onChange={(response) => setResponses({ ...responses, [currentItem.itemId]: response })} />{phase === "profile" && <div className="tip-line"><Sparkles className="size-4" /> Choisis ce que tu fais vraiment : ces réponses servent à proposer une méthode plus adaptée.</div>}</CardContent></Card><Navigation message={message} canBack onBack={previousQuestion} onNext={nextQuestion} nextLabel={index === (phase === "math" ? routed.mathItems.length : routed.profileItems.length) - 1 ? (phase === "math" ? "Passer au profil" : "Construire mon plan") : "Continuer"} /></div>}

        {phase === "planning" && <div className="content-stack"><div><p className="section-kicker">Dernière étape</p><h1 className="display-title smaller">Ton mini-plan sur trois jours</h1><p className="lead max-w-3xl">Imagine une prochaine révision de mathématiques. Écris une action précise, une méthode et une durée pour chaque jour.</p></div><div className="planning-grid">{["Jour 1", "Jour 2", "Jour 3"].map((day, dayIndex) => <Card key={day} className="plan-card"><CardContent><div className="plan-day"><span>0{dayIndex + 1}</span>{day}</div><Label htmlFor={`plan-${dayIndex}`}>Action, méthode et durée</Label><Textarea id={`plan-${dayIndex}`} className="mt-3 min-h-36 resize-none bg-white" placeholder={dayIndex === 0 ? "Ex. 25 min : me tester sans regarder le cours…" : "Décris ton action…"} value={planning[dayIndex]} onChange={(event) => setPlanning(planning.map((value, itemIndex) => itemIndex === dayIndex ? event.target.value : value))} /></CardContent></Card>)}</div><Navigation message={message} canBack onBack={() => goTo("profile", Math.max(0, (routed?.profileItems.length ?? 1) - 1))} onNext={submit} nextLabel={isSubmitting ? "Calcul du bilan…" : "Voir mon bilan"} disabled={isSubmitting} loading={isSubmitting} /></div>}

        {phase === "result" && result && <div className="content-stack result-view"><div className="result-hero"><div className="result-icon"><CheckCircle2 /></div><p className="section-kicker">Bilan pédagogique de {student.firstName}</p><h1 className="display-title smaller">{result.profileTitle}</h1><p className="lead max-w-3xl">Voici une lecture de tes acquis et de ta manière d’apprendre. Il n’y a volontairement pas de note globale.</p>{result.diagnosticContext && <div className="coverage-summary"><span>{result.diagnosticContext.modeLabel}</span><span>{result.diagnosticContext.assessedMathItems} questions de maths évaluées</span><span>{result.diagnosticContext.notAssessedTopicCount} chapitres non évalués</span></div>}</div><div className="grid gap-5 md:grid-cols-2"><Card className="result-card strengths-card"><CardContent><div className="result-card-title"><Sparkles /> Tes points d’appui</div><div className="space-y-4">{result.strengths.map((item) => <div key={item.domainCode} className="result-list-item"><span>{item.domainCode.slice(0, 3)}</span><div><strong>{item.label}</strong><p>{item.band} · {Math.round(item.score)}/100</p></div></div>)}</div></CardContent></Card><Card className="result-card"><CardContent><div className="result-card-title"><BrainCircuit /> Ta confiance</div><p className="text-xl font-bold">{result.calibration.label}</p><p className="mt-2 leading-7 text-[var(--muted-foreground)]">Écart moyen entre confiance et réussite : {Math.round(result.calibration.gap)} points.</p></CardContent></Card></div><Card className="result-card"><CardContent><div className="result-card-title"><Target /> Tes priorités</div><div className="priority-grid">{result.priorities.map((item, priorityIndex) => <article key={item.domainCode} className="priority-item"><span className="priority-index">0{priorityIndex + 1}</span><p className="text-sm font-bold text-[var(--deep-blue)]">{item.label}</p><h3>{item.title}</h3><p>{item.action}</p><span className="duration-pill">{item.duration}</span></article>)}</div></CardContent></Card><div className="grid gap-5 xl:grid-cols-2"><Card className="result-card"><CardContent><div className="result-card-title"><ClipboardCheck /> Compétences mathématiques</div><div className="space-y-5">{result.mathScores.map((item) => <ScoreBar key={item.domainCode} {...item} />)}</div></CardContent></Card><Card className="result-card"><CardContent><div className="result-card-title"><BrainCircuit /> Profil d’apprentissage</div><div className="space-y-5">{result.studyScores.map((item) => <ScoreBar key={item.domainCode} {...item} />)}</div></CardContent></Card></div>{(result.notAssessedTopics?.length ?? 0) > 0 && <Card className="result-card"><CardContent><div className="result-card-title"><ShieldCheck /> Chapitres non évalués</div><p className="text-[var(--muted-foreground)]">Ils ne diminuent pas le résultat : {result.notAssessedTopics!.map((topic) => topic.label).filter((label, itemIndex, labels) => labels.indexOf(label) === itemIndex).join(", ")}.</p></CardContent></Card>}<div className="next-step-card"><div><p className="section-kicker">La suite</p><h2>Le bilan détaillé sera relu avec Vincent.</h2><p>{result.notice}</p></div><div className="scenario-score"><span>Profil d’apprentissage</span><strong>{Math.round(result.scenarioScore)}/100</strong></div></div></div>}
      </section>
    </div>
  </main>;
}
