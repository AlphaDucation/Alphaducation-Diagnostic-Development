import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("../supabase/admin_dashboard.sql", import.meta.url), "utf8");

test("admin attempt RPC parameters are qualified against joined columns", () => {
  assert.match(sql, /where a\.id = admin_get_diagnostic_attempt\.attempt_id/);
  assert.match(sql, /where r\.attempt_id = admin_update_diagnostic_review\.attempt_id/);
  assert.match(sql, /on conflict on constraint diagnostic_attempt_reviews_pkey/);
  assert.doesNotMatch(sql, /where a\.id = attempt_id/);
  assert.doesNotMatch(sql, /where r\.attempt_id = attempt_id/);
  assert.doesNotMatch(sql, /on conflict \(attempt_id\)/);
});
