# Supabase

The connected `Alphaducation Diagnostic Development` project contains two applied migrations:

- `initial_alphadiagnostic`: published French EB7 content, private scoring keys, private attempts, RLS, and the validated `submit_diagnostic` RPC.
- `harden_private_tables`: explicit no-direct-access policies, a supporting foreign-key index, and anonymous-only RPC execution.

The browser never receives database credentials. The two server routes use the Sites runtime variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

The administrator dashboard schema is documented in `admin_dashboard.sql`. It adds:

- an allowlisted administrator linked to Supabase Auth;
- private review status and pedagogical notes;
- narrowly granted RPC functions that verify `auth.uid()` before reading student data;
- explicit denial of direct `anon` and `authenticated` table access.

Administrator addresses belong only in the private database allowlist and must not be committed to source control.
