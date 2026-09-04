"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpenCheck, CheckCircle2, ChevronRight, Clock3, Eye, FileText, GraduationCap, LoaderCircle, LockKeyhole, LogOut, Mail, RefreshCw, Search, ShieldCheck, Sparkles, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { AttemptDetail, AttemptListItem, AttemptListResponse, ReviewStatus } from "@/app/admin/admin-types";
import type { DomainScore } from "@/app/types";

const statusLabels: Record<ReviewStatus, string> = { new: "Nouveau", in_review: "En cours", reviewed: "Relu" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-LB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Beirut" }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge className={`admin-status status-${status}`} variant="outline">{statusLabels[status]}</Badge>;
}

function ScoreLine({ item }: { item: DomainScore }) {
  return <div className="admin-score-line"><div className="flex items-center justify-between gap-4"><span>{item.label}</span><strong>{Math.round(item.score)}/100</strong></div><div className="admin-score-track"><span style={{ width: `${Math.max(2, item.score)}%` }} /></div></div>;
}

function LoginPanel({ onAuthenticated }: { onAuthenticated: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Connexion impossible.");
      onAuthenticated(data.email ?? email);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connexion impossible."); }
    finally { setLoading(false); }
  }

  return <main className="admin-login-shell">
    <div className="admin-login-brand"><div className="brand-mark">α</div><div><p className="brand-name">alphaducation</p><p className="brand-subtitle">Espace pédagogique</p></div></div>
    <Card className="admin-login-card"><CardContent>
      <div className="admin-login-icon"><LockKeyhole /></div>
      <p className="section-kicker">Accès privé</p>
      <h1>Tableau de bord<br />AlphaDiagnostic</h1>
      <p className="admin-login-copy">Consulte les passations, analyse les profils et prépare le suivi pédagogique de chaque élève.</p>
      <form className="mt-8 space-y-5" onSubmit={submit}>
        <div><Label htmlFor="admin-email">Adresse e-mail</Label><div className="admin-input-wrap"><Mail /><Input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></div>
        <div><Label htmlFor="admin-password">Mot de passe</Label><div className="admin-input-wrap"><LockKeyhole /><Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></div></div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <Button className="primary-action w-full" size="lg" disabled={loading}>{loading && <LoaderCircle className="animate-spin" />}Se connecter <ChevronRight /></Button>
      </form>
      <div className="admin-security-note"><ShieldCheck /><span>Les données nominatives restent protégées par une session administrateur sécurisée.</span></div>
    </CardContent></Card>
  </main>;
}

function AttemptDetailPanel({ attempt, loading, onClose, onSaved }: { attempt: AttemptDetail | null; loading: boolean; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<ReviewStatus>(attempt?.review.status ?? "new");
  const [notes, setNotes] = useState(attempt?.review.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveReview() {
    if (!attempt) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/attempts/${attempt.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, notes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Enregistrement impossible.");
      setMessage("Suivi enregistré."); onSaved();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  return <Sheet open={loading || Boolean(attempt)} onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent className="admin-detail-sheet w-full sm:max-w-3xl">
    {loading && <div className="grid h-full place-items-center"><div className="text-center"><LoaderCircle className="mx-auto mb-3 animate-spin text-[var(--teal)]" /><p>Chargement du bilan…</p></div></div>}
    {attempt && <div className="admin-detail-scroll">
      <SheetHeader className="admin-detail-header"><div className="flex flex-wrap items-center gap-3"><StatusBadge status={attempt.review.status} /><span className="text-sm text-[var(--muted-foreground)]">{formatDate(attempt.completedAt)}</span></div><SheetTitle>{attempt.student.firstName} {attempt.student.lastName}</SheetTitle><SheetDescription>{attempt.student.grade} · {attempt.result.profileTitle}</SheetDescription></SheetHeader>
      <div className="admin-detail-content">
        <section className="admin-detail-section"><h2><UserRound /> Élève et responsable</h2><div className="admin-detail-grid"><div><span>Niveau</span><strong>{attempt.student.grade}</strong></div><div><span>Durée</span><strong>{formatDuration(attempt.durationSeconds)}</strong></div><div><span>Responsable</span><strong>{attempt.guardian.name}</strong></div><div><span>Contact</span><strong>{attempt.guardian.contact}</strong></div></div></section>
        <section className="admin-detail-section"><h2><Sparkles /> Lecture rapide</h2><div className="admin-priority-grid"><div className="admin-strength-box"><span>Points d’appui</span>{attempt.result.strengths.map((item) => <p key={item.domainCode}><strong>{item.label}</strong> · {Math.round(item.score)}/100</p>)}</div><div className="admin-priority-box"><span>Priorités</span>{attempt.result.priorities.map((item) => <p key={item.domainCode}><strong>{item.label}</strong> · {item.title}</p>)}</div></div></section>
        <section className="admin-detail-section"><h2><BarChart3 /> Résultats par domaine</h2><div className="admin-results-grid"><div><h3>Mathématiques</h3>{attempt.result.mathScores.map((item) => <ScoreLine key={item.domainCode} item={item} />)}</div><div><h3>Méthodes de travail</h3>{attempt.result.studyScores.map((item) => <ScoreLine key={item.domainCode} item={item} />)}</div></div><div className="admin-calibration"><span>Confiance</span><strong>{attempt.result.calibration.label}</strong><p>Écart moyen : {Math.round(attempt.result.calibration.gap)} points · Réactions en situation : {Math.round(attempt.result.scenarioScore)}/100</p></div></section>
        <section className="admin-detail-section"><h2><BookOpenCheck /> Mini-plan proposé</h2><div className="space-y-3">{(attempt.responses.planning ?? []).map((day) => <div className="admin-plan-line" key={day.day}><span>{day.day}</span><p>{day.text}</p></div>)}</div></section>
        <section className="admin-detail-section admin-review-section"><h2><FileText /> Validation pédagogique</h2><div className="grid gap-4 sm:grid-cols-[210px_1fr]"><div><Label htmlFor="review-status">État du dossier</Label><NativeSelect id="review-status" className="mt-2 h-11 w-full bg-white" value={status} onChange={(event) => setStatus(event.target.value as ReviewStatus)}><NativeSelectOption value="new">Nouveau</NativeSelectOption><NativeSelectOption value="in_review">En cours de relecture</NativeSelectOption><NativeSelectOption value="reviewed">Relu et validé</NativeSelectOption></NativeSelect></div><div><Label htmlFor="review-notes">Notes de Vincent</Label><Textarea id="review-notes" className="mt-2 min-h-32 resize-y bg-white" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} placeholder="Observations, points à vérifier, recommandations pour l’entretien…" /></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3">{message ? <p className={message === "Suivi enregistré." ? "admin-success" : "error-message"}>{message}</p> : <span />}<Button className="primary-action" onClick={saveReview} disabled={saving}>{saving && <LoaderCircle className="animate-spin" />}Enregistrer le suivi</Button></div></section>
      </div>
    </div>}
  </SheetContent></Sheet>;
}

export default function AdminDashboard() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [data, setData] = useState<AttemptListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [grade, setGrade] = useState("");
  const [selected, setSelected] = useState<AttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { fetch("/api/admin/auth", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(); return response.json(); }).then((session) => setEmail(session.email ?? "Administrateur")).catch(() => setEmail("")).finally(() => setSessionLoading(false)); }, []);

  const loadAttempts = useCallback(async () => {
    if (!email) return;
    setLoading(true); setError("");
    const params = new URLSearchParams(); if (search.trim()) params.set("search", search.trim()); if (status) params.set("status", status); if (grade) params.set("grade", grade);
    try { const response = await fetch(`/api/admin/attempts?${params}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) { if (response.status === 401) setEmail(""); throw new Error(payload.error ?? "Chargement impossible."); } setData(payload); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Chargement impossible."); }
    finally { setLoading(false); }
  }, [email, search, status, grade]);

  useEffect(() => { const timeout = setTimeout(loadAttempts, search ? 300 : 0); return () => clearTimeout(timeout); }, [loadAttempts, search]);

  async function openAttempt(item: AttemptListItem) {
    setDetailLoading(true); setSelected(null);
    try { const response = await fetch(`/api/admin/attempts/${item.id}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Bilan indisponible."); setSelected(payload); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Bilan indisponible."); }
    finally { setDetailLoading(false); }
  }

  async function logout() { await fetch("/api/admin/auth", { method: "DELETE" }); setEmail(""); setData(null); }
  const cards = useMemo(() => data ? [
    { label: "Passations", value: data.total, icon: UsersRound, tone: "teal" },
    { label: "Nouveaux bilans", value: data.newCount, icon: Sparkles, tone: "orange" },
    { label: "En cours", value: data.inReviewCount, icon: Eye, tone: "blue" },
    { label: "Bilans relus", value: data.reviewedCount, icon: CheckCircle2, tone: "aqua" },
  ] : [] , [data]);

  if (sessionLoading) return <main className="admin-login-shell"><LoaderCircle className="size-8 animate-spin text-[var(--teal)]" /></main>;
  if (!email) return <LoginPanel onAuthenticated={setEmail} />;

  return <main className="admin-shell min-h-screen">
    <header className="admin-topbar"><div className="admin-topbar-inner"><div className="brand-lockup"><div className="brand-mark">α</div><div><p className="brand-name">alphaducation</p><p className="brand-subtitle">Pilotage pédagogique</p></div></div><div className="flex items-center gap-2"><div className="admin-account"><span>Connecté</span><strong>{email}</strong></div><Button variant="ghost" size="icon" aria-label="Se déconnecter" onClick={logout}><LogOut /></Button></div></div></header>
    <div className="admin-layout">
      <section className="admin-heading"><div><p className="section-kicker">AlphaDiagnostic · EB7</p><h1>Suivi des élèves</h1><p>Repère les profils prioritaires, relis les résultats et prépare chaque entretien.</p></div><Button variant="outline" onClick={loadAttempts} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /> Actualiser</Button></section>
      <section className="admin-stat-grid">{cards.map(({ label, value, icon: Icon, tone }) => <Card key={label} className="admin-stat-card"><CardContent><div className={`admin-stat-icon tone-${tone}`}><Icon /></div><div><strong>{value}</strong><span>{label}</span></div></CardContent></Card>)}</section>
      <section className="admin-workspace">
        <div className="admin-toolbar"><div className="admin-search"><Search /><Input aria-label="Rechercher un élève" placeholder="Rechercher un élève ou un contact…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><NativeSelect aria-label="Filtrer par niveau" value={grade} onChange={(event) => setGrade(event.target.value)}><NativeSelectOption value="">Tous les niveaux</NativeSelectOption><NativeSelectOption value="EB6">EB6</NativeSelectOption><NativeSelectOption value="Entrée en EB7">Entrée en EB7</NativeSelectOption><NativeSelectOption value="EB7">EB7</NativeSelectOption></NativeSelect><NativeSelect aria-label="Filtrer par statut" value={status} onChange={(event) => setStatus(event.target.value)}><NativeSelectOption value="">Tous les statuts</NativeSelectOption><NativeSelectOption value="new">Nouveau</NativeSelectOption><NativeSelectOption value="in_review">En cours</NativeSelectOption><NativeSelectOption value="reviewed">Relu</NativeSelectOption></NativeSelect></div>
        {error && <div className="admin-error"><ShieldCheck /><span>{error}</span></div>}
        {loading && !data && <div className="admin-empty"><LoaderCircle className="animate-spin" /><p>Chargement des passations…</p></div>}
        {!loading && data?.items.length === 0 && <div className="admin-empty"><GraduationCap /><h2>Aucune passation pour le moment</h2><p>Les nouveaux diagnostics apparaîtront ici dès qu’un élève aura terminé.</p></div>}
        {data && data.items.length > 0 && <><div className="admin-table-wrap"><Table><TableHeader><TableRow><TableHead>Élève</TableHead><TableHead>Niveau</TableHead><TableHead>Profil</TableHead><TableHead>Passation</TableHead><TableHead>Durée</TableHead><TableHead>Suivi</TableHead><TableHead><span className="sr-only">Ouvrir</span></TableHead></TableRow></TableHeader><TableBody>{data.items.map((item) => <TableRow key={item.id} className="admin-table-row" onClick={() => openAttempt(item)}><TableCell><strong>{item.studentFirstName} {item.studentLastName}</strong><span>{item.guardianContact}</span></TableCell><TableCell>{item.grade}</TableCell><TableCell className="max-w-72 whitespace-normal">{item.profileTitle}</TableCell><TableCell>{formatDate(item.completedAt)}</TableCell><TableCell>{formatDuration(item.durationSeconds)}</TableCell><TableCell><StatusBadge status={item.reviewStatus} /></TableCell><TableCell><Button variant="ghost" size="icon" aria-label={`Ouvrir le bilan de ${item.studentFirstName}`}><ChevronRight /></Button></TableCell></TableRow>)}</TableBody></Table></div><div className="admin-mobile-list">{data.items.map((item) => <button className="admin-mobile-card" key={item.id} onClick={() => openAttempt(item)}><div><strong>{item.studentFirstName} {item.studentLastName}</strong><span>{item.grade} · {formatDate(item.completedAt)}</span></div><StatusBadge status={item.reviewStatus} /><p>{item.profileTitle}</p><ChevronRight /></button>)}</div></>}
        <div className="admin-workspace-footer"><span>{data?.total ?? 0} dossier{data?.total === 1 ? "" : "s"}</span><span><Clock3 /> Durée moyenne : {formatDuration(data?.averageDurationSeconds ?? null)}</span></div>
      </section>
    </div>
    <AttemptDetailPanel key={selected?.id ?? (detailLoading ? "loading" : "closed")} attempt={selected} loading={detailLoading} onClose={() => { setSelected(null); setDetailLoading(false); }} onSaved={loadAttempts} />
  </main>;
}
