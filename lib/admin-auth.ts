import { cookies } from "next/headers";

const ACCESS_COOKIE = "alpha_admin_access";
const REFRESH_COOKIE = "alpha_admin_refresh";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: { email?: string };
};

async function runtimeEnv(): Promise<Required<RuntimeEnv>> {
  const { env } = await import("cloudflare:workers");
  const runtime = env as RuntimeEnv;
  if (!runtime.SUPABASE_URL || !runtime.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase n’est pas configuré.");
  }
  return runtime as Required<RuntimeEnv>;
}

function authHeaders(key: string, token?: string) {
  return {
    apikey: key,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };
}

export async function signInWithPassword(email: string, password: string) {
  const runtime = await runtimeEnv();
  const endpoint = new URL("/auth/v1/token", runtime.SUPABASE_URL);
  endpoint.searchParams.set("grant_type", "password");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: authHeaders(runtime.SUPABASE_PUBLISHABLE_KEY),
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as AuthSession;
}

export async function isAdminToken(token: string) {
  const runtime = await runtimeEnv();
  const response = await fetch(new URL("/rest/v1/rpc/admin_list_diagnostic_attempts", runtime.SUPABASE_URL), {
    method: "POST",
    headers: authHeaders(runtime.SUPABASE_PUBLISHABLE_KEY, token),
    body: JSON.stringify({ search_text: null, status_filter: null, grade_filter: null, limit_count: 1 }),
    cache: "no-store",
  });
  return response.ok;
}

export async function saveAdminSession(session: AuthSession) {
  const cookieStore = await cookies();
  const secure = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  cookieStore.set(ACCESS_COOKIE, session.access_token, { ...secure, maxAge: Math.max(60, session.expires_in ?? 3600) });
  cookieStore.set(REFRESH_COOKIE, session.refresh_token, { ...secure, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  cookieStore.set(REFRESH_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}

async function refreshSession(refreshToken: string) {
  const runtime = await runtimeEnv();
  const endpoint = new URL("/auth/v1/token", runtime.SUPABASE_URL);
  endpoint.searchParams.set("grant_type", "refresh_token");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: authHeaders(runtime.SUPABASE_PUBLISHABLE_KEY),
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as AuthSession;
}

export async function requireAdminToken() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (accessToken && await isAdminToken(accessToken)) return accessToken;

  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const refreshed = await refreshSession(refreshToken);
  if (!refreshed || !await isAdminToken(refreshed.access_token)) {
    await clearAdminSession();
    return null;
  }
  await saveAdminSession(refreshed);
  return refreshed.access_token;
}

export async function getAdminEmail(token: string) {
  const runtime = await runtimeEnv();
  const response = await fetch(new URL("/auth/v1/user", runtime.SUPABASE_URL), {
    headers: authHeaders(runtime.SUPABASE_PUBLISHABLE_KEY, token),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json() as { email?: string };
  return user.email ?? null;
}

export async function adminRpc(token: string, functionName: string, payload: Record<string, unknown>) {
  const runtime = await runtimeEnv();
  return fetch(new URL(`/rest/v1/rpc/${functionName}`, runtime.SUPABASE_URL), {
    method: "POST",
    headers: authHeaders(runtime.SUPABASE_PUBLISHABLE_KEY, token),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}
