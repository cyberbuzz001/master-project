# Vercel project setup — 12 November 2026

Followed https://vercel.com/get-started.md. Tool installations apply to this managed cloud workspace, not the user's Windows machine.

## Connection verified

- Vercel app integration is installed and authenticated. User completed the separate authorization for team `nikhilk-s-projects` (`team_LoEb69GRAsgSlhgfKdnWd8EI`). Authenticated team listing and project reads now succeed. Vercel documentation search also succeeds.
- Vercel CLI 65.14.0 is installed in user scope. Direct CLI login remains incomplete because the shell's network policy blocks Vercel API/authentication access. The connected app works independently; it was used for project configuration.
- Shared CLI MCP server `vercel` is registered at exactly `https://mcp.vercel.com` in `/home/agent/.codex/config.toml`. Its separate OAuth login remains blocked by shell network policy. The working app connection does not imply this separate CLI login succeeded.
- Standalone guidance from `vercel-labs/agent-skills` was installed under `/home/agent/.agents/skills` after terminal plugin installation failed to find the plugin in the CLI marketplaces. The subsequently connected Vercel app supplies its own platform guidance and tools.

## Existing project verified

- Project: https://vercel.com/nikhilk-s-projects/master-project-frontend
- Project ID: `prj_bSbe6RoKNY5X4SPTK1zstNT7A6BX`
- Team: `nikhilk-s-projects`
- Framework: Next.js
- Node.js: 24.x
- Production deployment: `dpl_HCjSwwLGAL3taG7jX7DirhBh77Ke`, status READY
- Deployed Git source: `cyberbuzz001/master-project`, branch `main`, commit `2022ea4deae0ebe23bb26be7bd945195ef150263`
- `www.expertstocks.in`: verified production domain
- `expertstocks.in`: verified, redirects to www with HTTP 308
- Vercel Authentication protection: `all_except_custom_domains`; preserved

The local checkout baseline is `b3035c0`, older than the deployed commit. Local audit patches must be reconciled with the newer branch before release. The source files `vercel.json`, `next.config.ts`, and `package.json` were read at the exact deployed SHA through GitHub.

## Configuration applied

The existing project update succeeded with these explicit settings:

| Setting | Value |
|---|---|
| Root directory | `expert-advisory/frontend` |
| Framework | `nextjs` |
| Build command | `next build` |
| Node.js | `24.x` |

Created a production-only Config variable, then verified it through the read API:

`NEXT_PUBLIC_SITE_URL=https://www.expertstocks.in`

There were no dashboard environment variables before this change. `BACKEND_URL` remains absent because no working Laravel deployment exists. No placeholder backend URL or invented credentials were added. No integration secret values were fetched or printed.

The frontend now has ignored `.vercel/project.json` metadata containing the verified project/team IDs and project name. This link file was written from authenticated API metadata, not by a successful `vercel link` CLI login. The repository's `frontend/vercel.json` was updated locally to the same www canonical origin and given its schema URL. That source change is not yet deployed; the deployed file still specifies the apex URL until a reviewed source update lands.

## Validation and deployment boundary

- Authenticated team/project read: passed.
- Project settings update: succeeded; framework and Node version confirmed by read-back. The normalized read response does not expose root directory or build command, so those fields are supported by the successful write rather than independently read back.
- Production environment-variable read-back: passed.
- Domain verification and apex redirect read-back: passed.
- Production deployment ID read-back: unchanged and READY.
- Local project-link metadata and gitignore check: passed.
- `vercel.json` JSON parsing and `git diff --check`: passed.

No deployment, promotion, DNS change, data migration, customer message, secret rotation or paid resource provisioning occurred. Updated project settings and environment variables apply to subsequent deployments; they do not rebuild the existing deployment automatically.

## Remaining CRM deployment work

The user confirmed Laravel is not deployed. The named Hostinger VPS hosts TradeGrow services, not this advisory backend. Do not point `BACKEND_URL` at the frontend, an invented API hostname, or TradeGrow's unrelated service.

1. Reconcile the local audit patch with the newer deployed Git revision. Preserve the newer WhatsApp provider-console work.
2. Repair and test the backend issues in `CRM_PRODUCTION_AUDIT_2026-11-12.md` using a working PHP/Composer environment with the repository's required Boost setup.
3. Provision or identify Laravel hosting, SQL database, queue workers, scheduler and private document storage. Avoid disrupting the existing TradeGrow services.
4. Configure application/session/Sanctum settings for production and preview separately; rotate exposed provider credentials and configure Meta's actual WABA, phone ID, app secret, verify token and approved templates.
5. Set `BACKEND_URL` to the verified backend HTTPS origin at build/runtime, stage the combined release and verify login/2FA, staff creation, imports, trial lifecycle messages, educational documents, entitled research, opt-out and failure recovery.
6. Deploy only after those acceptance checks pass. The prepared frontend security patch intentionally retires prototype APIs and needs the genuine backend for CRM functionality.
