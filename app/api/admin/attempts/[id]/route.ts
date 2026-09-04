import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRpc, requireAdminToken } from "@/lib/admin-auth";

const idSchema = z.string().uuid();
const reviewSchema = z.object({
  status: z.enum(["new", "in_review", "reviewed"]),
  notes: z.string().max(5000).default(""),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const token = await requireAdminToken();
  if (!token) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ error: "Passation invalide." }, { status: 400 });
  const response = await adminRpc(token, "admin_get_diagnostic_attempt", { attempt_id: id.data });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error(`admin_get_diagnostic_attempt failed (${response.status})`, detail);
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ error: "Session expirée." }, { status: 401 });
    }
    if (response.status === 404) {
      return NextResponse.json({ error: "Passation introuvable." }, { status: 404 });
    }
    return NextResponse.json({ error: "Impossible de charger ce dossier." }, { status: 502 });
  }
  return NextResponse.json(await response.json(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request, context: Context) {
  const token = await requireAdminToken();
  if (!token) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const id = idSchema.safeParse((await context.params).id);
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const parsed = reviewSchema.safeParse(input);
  if (!id.success || !parsed.success) return NextResponse.json({ error: "Données de suivi invalides." }, { status: 400 });
  const response = await adminRpc(token, "admin_update_diagnostic_review", {
    attempt_id: id.data,
    review_status: parsed.data.status,
    review_notes: parsed.data.notes,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error(`admin_update_diagnostic_review failed (${response.status})`, detail);
    return NextResponse.json(
      { error: response.status === 401 || response.status === 403 ? "Session expirée." : "Impossible d’enregistrer le suivi." },
      { status: response.status === 401 || response.status === 403 ? 401 : 502 },
    );
  }
  return NextResponse.json(await response.json(), { headers: { "Cache-Control": "private, no-store" } });
}
