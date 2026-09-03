import { NextResponse } from "next/server";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };
}

export async function GET() {
  const runtime = await runtimeEnv();
  if (!runtime.SUPABASE_URL || !runtime.SUPABASE_PUBLISHABLE_KEY) return NextResponse.json({ error: "Le diagnostic n’est pas encore configuré." }, { status: 503 });
  const endpoint = new URL("/rest/v1/diagnostic_versions", runtime.SUPABASE_URL);
  endpoint.searchParams.set("select", "slug,version,language,title,estimated_minutes,content");
  endpoint.searchParams.set("slug", "eq.eb7-fr");
  endpoint.searchParams.set("status", "eq.published");
  endpoint.searchParams.set("limit", "1");
  const response = await fetch(endpoint, { headers: { apikey: runtime.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${runtime.SUPABASE_PUBLISHABLE_KEY}` }, cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Impossible de charger le diagnostic pour le moment." }, { status: 502 });
  const rows = await response.json() as unknown[];
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "Aucun diagnostic publié n’est disponible." }, { status: 404 });
  return NextResponse.json(rows[0], { headers: { "Cache-Control": "private, no-store" } });
}
