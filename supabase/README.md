# Supabase

The connected `Alphaducation Diagnostic Development` project contains two applied migrations:

- `initial_alphadiagnostic`: published French EB7 content, private scoring keys, private attempts, RLS, and the validated `submit_diagnostic` RPC.
- `harden_private_tables`: explicit no-direct-access policies, a supporting foreign-key index, and anonymous-only RPC execution.

The browser never receives database credentials. The two server routes use the Sites runtime variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
