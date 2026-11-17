# WHH partnership frontend

React, TypeScript and Fluent UI application for the existing WHH-DB GitHub Pages site. Sign in uses the existing Supabase application account and active-user authorization. This public source contains no partner exports, workbook records, contact lists or privileged keys. Partner and source-cache data are fetched after sign-in under Supabase access rules. No partner data is saved to browser localStorage by this frontend.

Build with `npm ci`, `npx tsc --noEmit`, `node --experimental-strip-types --test tests/import-validation.test.ts`, then `npm run build`. From the repository root run `node scripts/publish-github-pages.mjs` and commit the source plus generated root index/assets/setup files. GitHub Pages continues deploying main at /WHH-DB/. The original editor is retained at legacy.html with its existing scripts.

The public browser key is the same key used by the existing app; it grants no privileged database access. Never add a service-role/secret key or passwords to this source. Optional environment overrides are documented in .env.example.

The database setup script at public/setup/whh_shared_updates.sql must be reviewed and run in Supabase SQL Editor to enable the new shared-save and import functions. It requires the original database/01_Admin_And_Other.sql admin guard. The frontend checks readiness and keeps new shared writes gated until setup succeeds. The existing editor remains available during activation. The SQL setup has not been executed by this frontend deployment and needs database testing before operational use.

Source exports are uploaded through Import update after sign-in. CSV validation preserves identifiers and rejects invalid dates, conflicting records and duplicate relationships. Only an active administrator can apply imports or use the new save functions. No export rows are included in public assets. Project/partner identity matching requires explicit review; source assignments never create agreements automatically.
