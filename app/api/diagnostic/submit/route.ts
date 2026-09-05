import { NextResponse } from "next/server";
import { z } from "zod";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };
}

const legacySubmissionSchema = z.object({
  clientReference: z.string().uuid(), diagnosticSlug: z.literal("eb7-fr"), diagnosticVersion: z.number().int().positive(), language: z.literal("fr"), durationSeconds: z.number().int().min(0).max(14400),
  student: z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), grade: z.string().trim().min(1).max(30), guardianName: z.string().trim().min(1).max(120), guardianContact: z.string().trim().min(3).max(160), consentConfirmed: z.literal(true), parentConfirmed: z.literal(true) }),
  responses: z.object({
    math: z.array(z.object({ itemId: z.string().min(1).max(30), answer: z.record(z.unknown()), confidence: z.number().min(0).max(100) })).length(12),
    study: z.array(z.object({ itemId: z.string().min(1).max(30), value: z.number().int().min(1).max(4) })).length(24),
    scenarios: z.array(z.object({ itemId: z.string().min(1).max(30), optionId: z.string().min(1).max(30) })).length(6),
    planning: z.array(z.object({ day: z.string().min(1).max(30), text: z.string().trim().min(3).max(1000) })).length(3),
  }),
});

const multilevelSubmissionSchema = z.object({
  clientReference: z.string().uuid(),
  diagnosticSlug: z.string().regex(/^math-[a-z0-9-]+-fr$/).max(60),
  diagnosticVersion: z.number().int().positive(),
  language: z.literal("fr"),
  durationSeconds: z.number().int().min(0).max(14400),
  student: z.object({
    firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), grade: z.string().trim().min(1).max(30),
    guardianName: z.string().trim().min(1).max(120), guardianContact: z.string().trim().min(3).max(160),
    consentConfirmed: z.literal(true), parentConfirmed: z.literal(true),
  }),
  routing: z.object({
    mode: z.enum(["entry_diagnostic", "midyear", "end_year", "placement"]),
    stream: z.string().regex(/^(ALL|SCI|HUM|SG|SV|SE|LH)$/),
    includeProbes: z.boolean().default(false),
    topicCoverage: z.array(z.object({
      topicId: z.string().min(3).max(100),
      status: z.enum(["taught", "in_progress", "not_taught", "unknown"]),
    })).max(120),
  }),
  responses: z.object({
    items: z.array(z.object({
      itemId: z.string().min(3).max(100),
      optionId: z.string().min(3).max(120).optional(),
      answer: z.string().trim().max(1200).optional(),
      confidence: z.number().min(0).max(100).optional(),
    }).refine((value) => Boolean(value.optionId || value.answer), "Réponse manquante")).min(8).max(80),
    planning: z.array(z.object({ day: z.string().min(1).max(30), text: z.string().trim().min(3).max(1000) })).length(3),
  }),
});

export async function POST(request: Request) {
  const runtime = await runtimeEnv();
  if (!runtime.SUPABASE_URL || !runtime.SUPABASE_PUBLISHABLE_KEY) return NextResponse.json({ error: "Le diagnostic n’est pas encore configuré." }, { status: 503 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Envoi invalide." }, { status: 400 }); }
  const isMultilevel = typeof raw === "object" && raw !== null && "diagnosticSlug" in raw && String((raw as { diagnosticSlug?: unknown }).diagnosticSlug).startsWith("math-");
  const parsed = (isMultilevel ? multilevelSubmissionSchema : legacySubmissionSchema).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Certaines réponses sont manquantes ou invalides." }, { status: 400 });
  const endpoint = new URL(`/rest/v1/rpc/${isMultilevel ? "submit_diagnostic_v2" : "submit_diagnostic"}`, runtime.SUPABASE_URL);
  const response = await fetch(endpoint, { method: "POST", headers: { apikey: runtime.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${runtime.SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ payload: parsed.data }), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Le bilan n’a pas pu être calculé. Réessaie dans un instant." }, { status: response.status >= 500 ? 502 : 400 });
  return NextResponse.json(await response.json(), { headers: { "Cache-Control": "private, no-store" } });
}
