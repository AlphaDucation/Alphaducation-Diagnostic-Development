# Supabase

The connected `Alphaducation Diagnostic Development` project contains the legacy EB7 diagnostic and the multi-level runtime:

- `initial_alphadiagnostic`: published French EB7 content, private scoring keys, private attempts, RLS, and the validated `submit_diagnostic` RPC.
- `harden_private_tables`: explicit no-direct-access policies, a supporting foreign-key index, and anonymous-only RPC execution.
- `add_multilevel_diagnostic_runtime`: a validated, insert-only `submit_diagnostic_v2` RPC for G6 through Terminale, including stream routing, taught-topic checks, skill/process scoring, confidence calibration, misconceptions, interventions, and non-assessed topic reporting.

The browser never receives scoring keys or privileged database credentials. Server routes use the runtime variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; public question content is exposed only through published rows protected by RLS.

The administrator dashboard schema is documented in `admin_dashboard.sql`. It adds:

- an allowlisted administrator linked to Supabase Auth;
- private review status and pedagogical notes;
- narrowly granted RPC functions that verify `auth.uid()` before reading student data;
- explicit denial of direct `anon` and `authenticated` table access.

Administrator addresses belong only in the private database allowlist and must not be committed to source control.
