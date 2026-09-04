import { NextResponse } from "next/server";
import { z } from "zod";
import { clearAdminSession, getAdminEmail, isAdminToken, requireAdminToken, saveAdminSession, signInWithPassword } from "@/lib/admin-auth";

const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(200),
});

export async function GET() {
  const token = await requireAdminToken();
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, email: await getAdminEmail(token) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Vérifie l’adresse e-mail et le mot de passe." }, { status: 400 });

  const session = await signInWithPassword(parsed.data.email.toLowerCase(), parsed.data.password);
  if (!session || !await isAdminToken(session.access_token)) {
    await clearAdminSession();
    return NextResponse.json({ error: "Identifiants incorrects ou accès non autorisé." }, { status: 401 });
  }
  await saveAdminSession(session);
  return NextResponse.json({ authenticated: true, email: session.user?.email ?? parsed.data.email }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "private, no-store" } });
}
