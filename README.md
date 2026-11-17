# WHH Ethiopia Partnership Management

The current React interface is deployed at https://mekdes9708.github.io/WHH-DB/ using the existing GitHub Pages deployment from main. Use the existing Supabase application account to sign in.

The public repository contains the interface and database setup code, not partner exports or contact records. Live partner data is retrieved after authentication under Supabase access rules. The existing browser publishable key is not a privileged key. Never commit passwords, service-role keys, database exports or real contact fixtures.

The previous interface is preserved at https://mekdes9708.github.io/WHH-DB/legacy.html, with its existing scripts. It remains available while the new shared-save and import functions are activated.

## Update the interface

```sh
cd frontend
npm ci
npx tsc --noEmit
node --experimental-strip-types --test tests/import-validation.test.ts
npm run build
cd ..
node scripts/publish-github-pages.mjs
```

Commit both frontend source and generated root index/assets/setup files to main. The Vite base is /WHH-DB/. Do not commit node_modules or private data files.

## Activate shared saves and imports

Review and run setup/whh_shared_updates.sql in the existing Supabase project's SQL Editor. It requires the original database/01_Admin_And_Other.sql admin guard. The setup does not seed or overwrite existing partner records. Sign in and refresh Database connection to check readiness. New shared saves and source imports remain gated until this succeeds. Use the existing editor during activation.

ProMIS partner-project CSV files are imported through Import update after sign-in. Inspect the validation results before applying an update as an administrator. Source-cache records, local partner profiles and agreements remain distinct internally; users work through one Partners register.

The SQL setup still requires database testing. This deployment does not execute schema migrations or modify live Supabase records.
