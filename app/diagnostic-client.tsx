"use client";
/* The two local brand assets are pre-sized and compressed for the Worker runtime. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BrainCircuit, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, LoaderCircle, RotateCcw, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Choice, DiagnosticDefinition, DiagnosticResult, MathQuestion } from "@/app/types";

type Phase = "identity" | "math" | "study" | "scenario" | "planning" | "result";
type AnswerObject = Record<string, string | string[]>;
type MathEntry = { answer: AnswerObject; confidence?: number };

const phases: Array<{ key: Phase; short: string; label: string }> = [
  { key: "identity", short: "01", label: "Profil" }, { key: "math", short: "02", label: "Mathématiques" },
  { key: "study", short: "03", label: "Méthodes" }, { key: "scenario", short: "04", label: "Situations" },
  { key: "planning", short: "05", label: "Mini-plan" }, { key: "result", short: "06", label: "Bilan" },
];

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-lockup ${compact ? "is-compact" : ""}`}>
    <span className="brand-symbol"><img src="/brand/alphaducation-mark.png" alt="" /></span>
    <span className="brand-words"><strong>alphaducation</strong><small>Diagnostic pédagogique</small></span>
  </div>;
}

function ChoiceGrid({ choices, value, onChange, columns = 1 }: { choices: Choice[]; value?: string; onChange: (value: string) => void; columns?: 1 | 2 }) {
  return <div className={columns === 2 ? "choice-grid choice-grid-two" : "choice-grid"}>{choices.map((choice) => {
    const selected = value === choice.id;
    return <button type="button" key={choice.id} className={`choice-card ${selected ? "is-selected" : ""}`} onClick={() => onChange(choice.id)} aria-pressed={selected}>
      <span className="choice-indicator" aria-hidden="true">{selected && <Check className="size-3.5" strokeWidth={3} />}</span><span>{choice.text}</span>
    </button>;
  })}</div>;
}

function MathAnswerField({ question, value, onChange }: { question: MathQuestion; value: AnswerObject; onChange: (answer: AnswerObject) => void }) {
  if (question.format === "option") return <ChoiceGrid choices={question.options ?? []} value={value.optionId as string | undefined} onChange={(optionId) => onChange({ optionId })} columns={2} />;
  if (question.format === "order") {
    const ordered = (value.order as string[] | undefined) ?? [];
    const available = (question.tokens ?? []).filter((token) => !ordered.includes(token));
    return <div className="space-y-5"><div className="order-zone" aria-label="Ordre choisi">{ordered.length === 0 ? <span className="text-sm text-[var(--muted-foreground)]">Sélectionne les nombres du plus petit au plus grand.</span> : ordered.map((token, i) => <span key={token} className="order-token"><span className="token-index">{i + 1}</span>{token}</span>)}</div><div className="flex flex-wrap gap-2">{available.map((token) => <Button key={token} type="button" variant="outline" onClick={() => onChange({ order: [...ordered, token] })}>{token}</Button>)}{ordered.length > 0 && <Button type="button" variant="ghost" onClick={() => onChange({ order: [] })}><RotateCcw /> Recommencer</Button>}</div></div>;
  }
  if (question.format === "numeric") return <div className="max-w-sm"><Label htmlFor={`${question.id}-value`}>Ta réponse</Label><Input id={`${question.id}-value`} className="mt-2 h-12 text-lg" inputMode="decimal" placeholder={question.placeholder} value={(value.value as string) ?? ""} onChange={(e) => onChange({ value: e.target.value })} /></div>;
  if (question.format === "angle_triangle") return <div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor={`${question.id}-angle`}>Mesure de l’angle C</Label><div className="relative mt-2"><Input id={`${question.id}-angle`} className="h-12 pr-10 text-lg" inputMode="decimal" value={(value.angle as string) ?? ""} onChange={(e) => onChange({ ...value, angle: e.target.value })} /><span className="absolute right-4 top-3 text-lg text-[var(--muted-foreground)]">°</span></div></div><div><Label htmlFor={`${question.id}-triangle`}>Nature du triangle</Label><NativeSelect id={`${question.id}-triangle`} className="mt-2 h-12 w-full bg-white" value={(value.triangle as string) ?? ""} onChange={(e) => onChange({ ...value, triangle: e.target.value })}><NativeSelectOption value="">Choisir</NativeSelectOption><NativeSelectOption value="isocele_a">Isocèle en A</NativeSelectOption><NativeSelectOption value="equilateral">Équilatéral</NativeSelectOption><NativeSelectOption value="rectangle">Rectangle</NativeSelectOption><NativeSelectOption value="quelconque">Quelconque</NativeSelectOption></NativeSelect></div></div>;
  if (question.format === "true_justify") return <div className="space-y-5"><ChoiceGrid choices={[{ id: "vrai", text: "Vrai" }, { id: "faux", text: "Faux" }]} value={value.choice as string | undefined} onChange={(choice) => onChange({ ...value, choice })} columns={2} /><div><Label htmlFor={`${question.id}-justification`}>Explique ton raisonnement</Label><Textarea id={`${question.id}-justification`} className="mt-2 min-h-28 resize-none bg-white" placeholder="J’explique avec mes mots…" value={(value.justification as string) ?? ""} onChange={(e) => onChange({ ...value, justification: e.target.value })} /></div></div>;
  return <div className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor={`${question.id}-width`}>Largeur (cm)</Label><Input id={`${question.id}-width`} className="mt-2 h-12 bg-white text-lg" inputMode="decimal" value={(value.width as string) ?? ""} onChange={(e) => onChange({ ...value, width: e.target.value })} /></div><div><Label htmlFor={`${question.id}-length`}>Longueur (cm)</Label><Input id={`${question.id}-length`} className="mt-2 h-12 bg-white text-lg" inputMode="decimal" value={(value.length as string) ?? ""} onChange={(e) => onChange({ ...value, length: e.target.value })} /></div></div><div><Label htmlFor={`${question.id}-verification`}>Ta vérification</Label><Textarea id={`${question.id}-verification`} className="mt-2 min-h-24 resize-none bg-white" placeholder="Je vérifie le périmètre…" value={(value.verification as string) ?? ""} onChange={(e) => onChange({ ...value, verification: e.target.value })} /></div></div>;
}

function ScoreBar({ score, label, band }: { score: number; label: string; band: string }) {
  return <div className="score-row"><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="font-semibold">{label}</span><span className="whitespace-nowrap text-[var(--muted-foreground)]">{Math.round(score)} · {band}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--aqua-pale)]"><div className="h-full rounded-full bg-[var(--teal)]" style={{ width: `${Math.max(3, score)}%` }} /></div></div>;
}

function Navigation({ message, canBack, onBack, onNext, nextLabel, disabled = false, loading = false }: { message: string; canBack: boolean; onBack: () => void; onNext: () => void; nextLabel: string; disabled?: boolean; loading?: boolean }) {
  return <div className="navigation-row"><div>{message && <p className="error-message" role="alert">{message}</p>}</div><div className="flex items-center gap-3">{canBack && <Button type="button" variant="ghost" size="lg" onClick={onBack}><ArrowLeft /> Précédent</Button>}<Button type="button" className="primary-action" size="lg" onClick={onNext} disabled={disabled}>{loading && <LoaderCircle className="animate-spin" />}{nextLabel}<ChevronRight /></Button></div></div>;
}

export default function DiagnosticClient() {
  const [definition, setDefinition] = useState<DiagnosticDefinition | null>(null);
  const [loadError, setLoadError] = useState("");
  const [phase, setPhase] = useState<Phase>("identity");
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const startedAt = useRef(0);
  const clientReference = useRef("");
  const [student, setStudent] = useState({ firstName: "", lastName: "", grade: "", guardianName: "", guardianContact: "", parentConfirmed: false, consentConfirmed: false });
  const [math, setMath] = useState<Record<string, MathEntry>>({});
  const [study, setStudy] = useState<Record<string, number>>({});
  const [scenarios, setScenarios] = useState<Record<string, string>>({});
  const [planning, setPlanning] = useState(["", "", ""]);

  useEffect(() => {
    startedAt.current = Date.now(); clientReference.current = crypto.randomUUID();
    fetch("/api/diagnostic", { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Chargement impossible"); return data as DiagnosticDefinition; }).then(setDefinition).catch((error: Error) => setLoadError(error.message));
  }, []);

  const activePhase = phases.findIndex((item) => item.key === phase);
  const progress = useMemo(() => {
    if (!definition) return 0;
    const total = 1 + definition.content.mathQuestions.length + definition.content.studyItems.length + definition.content.scenarios.length + 1;
    let done = phase === "identity" ? 0 : 1;
    if (["study", "scenario", "planning", "result"].includes(phase)) done += definition.content.mathQuestions.length; else if (phase === "math") done += index;
    if (["scenario", "planning", "result"].includes(phase)) done += definition.content.studyItems.length; else if (phase === "study") done += index;
    if (["planning", "result"].includes(phase)) done += definition.content.scenarios.length; else if (phase === "scenario") done += index;
    if (phase === "result") done += 1;
    return Math.round(done / total * 100);
  }, [definition, phase, index]);
  const currentMath = definition?.content.mathQuestions[index];
  const currentStudy = definition?.content.studyItems[index];
  const currentScenario = definition?.content.scenarios[index];
  const domainLabel = (code?: string) => definition?.content.domains.find((d) => d.code === code)?.label ?? "";
  const goTo = (next: Phase) => { setMessage(""); setIndex(0); setPhase(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const identityReady = () => Boolean(student.firstName.trim() && student.lastName.trim() && student.grade && student.guardianName.trim() && student.guardianContact.trim().length >= 3 && student.parentConfirmed && student.consentConfirmed);
  const mathReady = (q: MathQuestion, entry?: MathEntry) => {
    if (!entry || entry.confidence === undefined) return false;
    const a = entry.answer;
    if (q.format === "option") return Boolean(a.optionId);
    if (q.format === "order") return (a.order as string[] | undefined)?.length === q.tokens?.length;
    if (q.format === "numeric") return Boolean((a.value as string | undefined)?.trim());
    if (q.format === "angle_triangle") return Boolean(a.angle && a.triangle);
    if (q.format === "true_justify") return Boolean(a.choice && (a.justification as string | undefined)?.trim().length >= 3);
    return Boolean(a.width && a.length && (a.verification as string | undefined)?.trim().length >= 3);
  };
  const nextMath = () => { if (!currentMath || !mathReady(currentMath, math[currentMath.id])) return setMessage("Réponds à la question et indique ton niveau de confiance."); setMessage(""); if (index < definition!.content.mathQuestions.length - 1) setIndex(index + 1); else goTo("study"); };
  const nextStudy = () => { if (!currentStudy || !study[currentStudy.id]) return setMessage("Choisis la réponse qui décrit le mieux ce que tu fais vraiment."); setMessage(""); if (index < definition!.content.studyItems.length - 1) setIndex(index + 1); else goTo("scenario"); };
  const nextScenario = () => { if (!currentScenario || !scenarios[currentScenario.id]) return setMessage("Choisis la réaction qui te ressemble le plus."); setMessage(""); if (index < definition!.content.scenarios.length - 1) setIndex(index + 1); else goTo("planning"); };

  async function submit() {
    if (!definition || planning.some((day) => day.trim().length < 3)) return setMessage("Complète ton action pour chacun des trois jours.");
    setIsSubmitting(true); setMessage("");
    const payload = { clientReference: clientReference.current, diagnosticSlug: definition.slug, diagnosticVersion: definition.version, language: "fr" as const, durationSeconds: Math.min(14400, Math.max(0, Math.round((Date.now() - (startedAt.current || Date.now())) / 1000))), student, responses: {
      math: definition.content.mathQuestions.map((q) => ({ itemId: q.id, answer: math[q.id].answer, confidence: math[q.id].confidence })),
      study: definition.content.studyItems.map((item) => ({ itemId: item.id, value: study[item.id] })),
      scenarios: definition.content.scenarios.map((item) => ({ itemId: item.id, optionId: scenarios[item.id] })),
      planning: definition.content.planning.days.map((day, i) => ({ day, text: planning[i] })),
    } };
    try { const response = await fetch("/api/diagnostic/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Calcul impossible"); setResult(data as DiagnosticResult); goTo("result"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Une erreur est survenue."); }
    finally { setIsSubmitting(false); }
  }

  if (loadError) return <main className="site-shell grid min-h-screen place-items-center px-5"><Card className="state-card"><CardContent className="space-y-5 text-center"><BrandLockup /><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-50 text-[var(--orange)]"><RotateCcw /></div><h1 className="text-2xl font-bold">Le diagnostic est momentanément indisponible.</h1><p className="text-[var(--muted-foreground)]">{loadError}</p><Button className="primary-action" onClick={() => window.location.reload()}>Réessayer</Button></CardContent></Card></main>;
  if (!definition) return <main className="site-shell grid min-h-screen place-items-center"><div className="loading-state"><img src="/brand/alphaducation-mark.png" alt="Alphaducation" /><LoaderCircle className="size-6 animate-spin" /><p>Préparation de ton diagnostic…</p></div></main>;

  return <main className={`site-shell phase-${phase} min-h-screen`}>
    <header className="topbar"><div className="topbar-inner"><BrandLockup compact /><div className="topbar-meta"><span className="time-pill"><Clock3 /> environ {definition.estimated_minutes} min</span><span className="progress-copy"><strong>{progress}%</strong> complété</span></div></div><Progress value={progress} aria-label={`${progress}% du diagnostic complété`} className="brand-progress h-1 rounded-none bg-transparent [&_[data-slot=progress-indicator]]:bg-[var(--orange)]" /></header>
    <div className="diagnostic-layout">
      <aside className="journey-aside"><div className="journey-panel"><div><p className="journey-kicker">Ton parcours</p><p className="journey-title">Deux regards.<br />Un plan précis.</p></div><nav aria-label="Étapes du diagnostic" className="step-nav">{phases.map((item, i) => { const done = i < activePhase; const active = item.key === phase; return <div key={item.key} className={`step-item ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}><span className="step-number">{done ? <Check className="size-4" /> : item.short}</span><span>{item.label}</span></div>; })}</nav><div className="privacy-note"><ShieldCheck className="size-5" /><p><strong>Données protégées</strong><br />Tes réponses restent confidentielles et servent uniquement au suivi pédagogique.</p></div></div></aside>
      <section className="diagnostic-content"><div className="mobile-phase"><span>{phases[activePhase]?.short}</span><p>{phases[activePhase]?.label}</p><strong>{progress}%</strong></div>

      {phase === "identity" && <div className="identity-grid"><section className="identity-hero"><img className="identity-art" src="/brand/learning-path.webp" alt="" /><div className="identity-hero-content"><span className="edition-pill">Bilan d’entrée · EB7</span><p className="eyebrow">{definition.content.intro.eyebrow}</p><h1 className="display-title">{definition.content.intro.title}</h1><p className="lead">{definition.content.intro.description}</p><div className="feature-strip"><span><Target /> <strong>12</strong> défis mathématiques</span><span><BrainCircuit /> Méthode & mentalité</span><span><ClipboardCheck /> Plan personnalisé</span></div></div><div className="identity-manifesto"><span>Comprendre</span><span>Structurer</span><span>Progresser</span></div></section>
        <Card className="form-card"><CardContent className="space-y-7"><div className="form-heading"><span className="form-step">01</span><div><p className="section-kicker">Avant de commencer</p><h2 className="section-title">Faisons connaissance.</h2><p>Quelques informations pour relier le bilan au bon élève.</p></div></div><div className="grid gap-5 sm:grid-cols-2">
          <div><Label htmlFor="firstName">Prénom de l’élève</Label><Input id="firstName" className="field" value={student.firstName} onChange={(e) => setStudent({ ...student, firstName: e.target.value })} /></div><div><Label htmlFor="lastName">Nom de l’élève</Label><Input id="lastName" className="field" value={student.lastName} onChange={(e) => setStudent({ ...student, lastName: e.target.value })} /></div>
          <div><Label htmlFor="grade">Niveau scolaire</Label><NativeSelect id="grade" className="field w-full bg-white" value={student.grade} onChange={(e) => setStudent({ ...student, grade: e.target.value })}><NativeSelectOption value="">Choisir le niveau</NativeSelectOption><NativeSelectOption value="EB6">EB6</NativeSelectOption><NativeSelectOption value="Entrée en EB7">Entrée en EB7</NativeSelectOption><NativeSelectOption value="EB7">EB7</NativeSelectOption></NativeSelect></div><div><Label htmlFor="guardianName">Nom du responsable</Label><Input id="guardianName" className="field" value={student.guardianName} onChange={(e) => setStudent({ ...student, guardianName: e.target.value })} /></div><div className="sm:col-span-2"><Label htmlFor="guardianContact">Téléphone ou e-mail du responsable</Label><Input id="guardianContact" className="field" value={student.guardianContact} onChange={(e) => setStudent({ ...student, guardianContact: e.target.value })} /></div>
        </div><div className="consent-box space-y-4"><label className="consent-row"><Checkbox checked={student.parentConfirmed} onCheckedChange={(checked) => setStudent({ ...student, parentConfirmed: checked === true })} /><span>Je confirme être le responsable de l’élève ou avoir son autorisation.</span></label><label className="consent-row"><Checkbox checked={student.consentConfirmed} onCheckedChange={(checked) => setStudent({ ...student, consentConfirmed: checked === true })} /><span>J’accepte que ces réponses soient enregistrées pour établir et suivre son bilan pédagogique.</span></label></div><p className="notice-text">{definition.content.intro.notice}</p>{message && <p className="error-message" role="alert">{message}</p>}<Button className="primary-action start-action" size="lg" onClick={() => identityReady() ? goTo("math") : setMessage("Complète les informations et les deux confirmations pour continuer.")}>Commencer mon diagnostic <ArrowRight /></Button></CardContent></Card>
      </div>}

      {phase === "math" && currentMath && <div className="content-stack"><div className="question-heading"><div><p className="section-kicker">Mathématiques · {domainLabel(currentMath.domain)}</p><h1 className="section-title">Question {index + 1} sur {definition.content.mathQuestions.length}</h1></div><span className="difficulty-tag">{currentMath.difficulty}</span></div><Card className="question-card"><CardContent className="space-y-8"><div><p className="question-skill">{currentMath.subskill}</p><h2 className="question-prompt">{currentMath.prompt}</h2></div><MathAnswerField question={currentMath} value={math[currentMath.id]?.answer ?? {}} onChange={(answer) => setMath({ ...math, [currentMath.id]: { ...math[currentMath.id], answer } })} /><div className="confidence-panel"><div><p className="font-bold">Quel est ton niveau de confiance ?</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">Réponds honnêtement, cela fait partie du diagnostic.</p></div><div className="confidence-grid">{definition.content.confidenceScale.map((option) => { const selected = math[currentMath.id]?.confidence === option.value; return <button type="button" key={option.value} className={`confidence-button ${selected ? "is-selected" : ""}`} onClick={() => setMath({ ...math, [currentMath.id]: { answer: math[currentMath.id]?.answer ?? {}, confidence: option.value } })}><strong>{option.value}%</strong><span>{option.label}</span></button>; })}</div></div></CardContent></Card><Navigation message={message} canBack={index > 0} onBack={() => { setMessage(""); setIndex(index - 1); }} onNext={nextMath} nextLabel={index === definition.content.mathQuestions.length - 1 ? "Passer aux méthodes" : "Question suivante"} /></div>}

      {phase === "study" && currentStudy && <div className="content-stack"><div className="question-heading"><div><p className="section-kicker">Méthodes de travail · {domainLabel(currentStudy.domain)}</p><h1 className="section-title">Comment étudies-tu vraiment ?</h1></div><span className="counter-tag">{index + 1}/{definition.content.studyItems.length}</span></div><Card className="question-card"><CardContent className="space-y-8"><div><p className="question-skill">Pense à ce que tu fais habituellement</p><h2 className="question-prompt">{currentStudy.statement}</h2></div><div className="study-scale">{definition.content.studyScale.map((option) => { const selected = study[currentStudy.id] === option.value; return <button type="button" key={option.value} className={`scale-button ${selected ? "is-selected" : ""}`} onClick={() => setStudy({ ...study, [currentStudy.id]: option.value })}><span className="scale-number">{option.value}</span><span>{option.label}</span></button>; })}</div><div className="tip-line"><Sparkles className="size-4" /> Il n’y a pas de « bonne image » à donner : ton bilan sera utile seulement si tes réponses sont sincères.</div></CardContent></Card><Navigation message={message} canBack={index > 0} onBack={() => { setMessage(""); setIndex(index - 1); }} onNext={nextStudy} nextLabel={index === definition.content.studyItems.length - 1 ? "Passer aux situations" : "Continuer"} /></div>}

      {phase === "scenario" && currentScenario && <div className="content-stack"><div className="question-heading"><div><p className="section-kicker">Mise en situation · {currentScenario.construct}</p><h1 className="section-title">Que ferais-tu ?</h1></div><span className="counter-tag">{index + 1}/{definition.content.scenarios.length}</span></div><Card className="question-card scenario-card"><CardContent className="space-y-7"><div className="scenario-number">Situation {index + 1}</div><h2 className="question-prompt">{currentScenario.situation}</h2><ChoiceGrid choices={currentScenario.options} value={scenarios[currentScenario.id]} onChange={(optionId) => setScenarios({ ...scenarios, [currentScenario.id]: optionId })} /></CardContent></Card><Navigation message={message} canBack={index > 0} onBack={() => { setMessage(""); setIndex(index - 1); }} onNext={nextScenario} nextLabel={index === definition.content.scenarios.length - 1 ? "Construire mon plan" : "Situation suivante"} /></div>}

      {phase === "planning" && <div className="content-stack"><div><p className="section-kicker">Dernière étape</p><h1 className="display-title smaller">{definition.content.planning.title}</h1><p className="lead max-w-3xl">{definition.content.planning.prompt}</p></div><div className="planning-grid">{definition.content.planning.days.map((day, dayIndex) => <Card key={day} className="plan-card"><CardContent><div className="plan-day"><span>0{dayIndex + 1}</span>{day}</div><Label htmlFor={`plan-${dayIndex}`}>Action, méthode et durée</Label><Textarea id={`plan-${dayIndex}`} className="mt-3 min-h-36 resize-none bg-white" placeholder={dayIndex === 0 ? "Ex. 25 min : rappel actif du chapitre C…" : "Décris ton action…"} value={planning[dayIndex]} onChange={(e) => setPlanning(planning.map((value, i) => i === dayIndex ? e.target.value : value))} /></CardContent></Card>)}</div><Navigation message={message} canBack={false} onBack={() => undefined} onNext={submit} nextLabel={isSubmitting ? "Calcul du bilan…" : "Voir mon bilan"} disabled={isSubmitting} loading={isSubmitting} /></div>}

      {phase === "result" && result && <div className="content-stack result-view"><div className="result-hero"><div className="result-icon"><CheckCircle2 /></div><p className="section-kicker">Bilan pédagogique de {student.firstName}</p><h1 className="display-title smaller">{result.profileTitle}</h1><p className="lead max-w-3xl">Voici une lecture de tes acquis et de ta manière de travailler. Il n’y a volontairement pas de note globale.</p></div><div className="grid gap-5 md:grid-cols-2"><Card className="result-card strengths-card"><CardContent><div className="result-card-title"><Sparkles /> Tes points d’appui</div><div className="space-y-4">{result.strengths.map((item) => <div key={item.domainCode} className="result-list-item"><span>{item.domainCode}</span><div><strong>{item.label}</strong><p>{item.band} · {Math.round(item.score)}/100</p></div></div>)}</div></CardContent></Card><Card className="result-card"><CardContent><div className="result-card-title"><BrainCircuit /> Ta confiance</div><p className="text-xl font-bold">{result.calibration.label}</p><p className="mt-2 leading-7 text-[var(--muted-foreground)]">Écart moyen entre ta confiance et ta réussite : {Math.round(result.calibration.gap)} points. Cette mesure t’aide à savoir quand vérifier davantage ou quand te faire confiance.</p></CardContent></Card></div><Card className="result-card"><CardContent><div className="result-card-title"><Target /> Tes trois priorités</div><div className="priority-grid">{result.priorities.map((item, i) => <article key={item.domainCode} className="priority-item"><span className="priority-index">0{i + 1}</span><p className="text-sm font-bold text-[var(--deep-blue)]">{item.label}</p><h3>{item.title}</h3><p>{item.action}</p><span className="duration-pill">{item.duration}</span></article>)}</div></CardContent></Card><div className="grid gap-5 xl:grid-cols-2"><Card className="result-card"><CardContent><div className="result-card-title"><ClipboardCheck /> Mathématiques</div><div className="space-y-5">{result.mathScores.map((item) => <ScoreBar key={item.domainCode} {...item} />)}</div></CardContent></Card><Card className="result-card"><CardContent><div className="result-card-title"><BrainCircuit /> Méthodes de travail</div><div className="space-y-5">{result.studyScores.map((item) => <ScoreBar key={item.domainCode} {...item} />)}</div></CardContent></Card></div><div className="next-step-card"><div><p className="section-kicker">La suite</p><h2>Le bilan détaillé sera relu avec Vincent.</h2><p>{result.notice}</p></div><div className="scenario-score"><span>Réactions en situation</span><strong>{Math.round(result.scenarioScore)}/100</strong></div></div></div>}
      </section>
    </div>
  </main>;
}
