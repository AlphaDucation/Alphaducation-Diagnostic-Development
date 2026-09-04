import { NextResponse } from "next/server";
import { adminRpc, requireAdminToken } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const token = await requireAdminToken();
  if (!token) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const url = new URL(request.url);
  const response = await adminRpc(token, "admin_list_diagnostic_attempts", {
    search_text: url.searchParams.get("search") || null,
    status_filter: url.searchParams.get("status") || null,
    grade_filter: url.searchParams.get("grade") || null,
    limit_count: 200,
  });
  if (!response.ok) return NextResponse.json({ error: "Impossible de charger les passations." }, { status: response.status === 401 || response.status === 403 ? 401 : 502 });
  return NextResponse.json(await response.json(), { headers: { "Cache-Control": "private, no-store" } });
}
