import { NextResponse } from "next/server";
import type { BankDefinition, CatalogEntry } from "@/app/multilevel-types";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };
}

export async function GET() {
  const runtime = await runtimeEnv();
  if (!runtime.SUPABASE_URL || !runtime.SUPABASE_PUBLISHABLE_KEY) return NextResponse.json({ error: "Le catalogue n’est pas encore configuré." }, { status: 503 });
  const endpoint = new URL("/rest/v1/diagnostic_versions", runtime.SUPABASE_URL);
  endpoint.searchParams.set("select", "slug,version,language,title,estimated_minutes,content");
  endpoint.searchParams.set("status", "eq.published");
  endpoint.searchParams.set("order", "slug.asc");
  const response = await fetch(endpoint, {
    headers: { apikey: runtime.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${runtime.SUPABASE_PUBLISHABLE_KEY}` },
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ error: "Impossible de charger les niveaux pour le moment." }, { status: 502 });
  const rows = await response.json() as BankDefinition[];
  const entries: CatalogEntry[] = rows
    .filter((row) => row.content?.schemaVersion === "alphadiagnostic-bank-v1")
    .map((row) => ({
      slug: row.slug,
      version: row.version,
      title: row.title,
      estimatedMinutes: row.estimated_minutes,
      gradeCode: row.content.assessment.gradeCode,
      streamCode: row.content.assessment.streamCode,
      modes: row.content.routing.modes,
    }));
  return NextResponse.json({ items: entries }, { headers: { "Cache-Control": "private, no-store" } });
}
