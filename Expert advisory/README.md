# Expert Stocks Consultancy Platform

Research, advisory-operations, CRM and client-management platform for Expert Stocks Consultancy.

**Status:** Complete (Phases 1–10 delivered, production ready) — architecture, RBAC, sign-in with 2FA, audit trail, regulatory-profile and policy versioning, public website, CRM back-office, workforce training and attendance, client onboarding (risk profiling with verifiable report, encrypted document vault, KYC, agreements, client portal), billing (versioned prices, invoices, verified payments, receipts, subscriptions), research desk (market data abstraction, staleness detection, deterministic technical indicators, multi-stage approval workflow, compliance gate, disclosure engine, performance ledger, distributions), AI assistive intelligence & Compliance Guardian grounding validator, communications engine with SEBI consent verification gate, SEBI Grievance Redressal desk with 21-day SLA & SCORES escalation, client support ticketing, deep system diagnostics, and automated zero-downtime deployment suite (`deploy/`). See [docs/PHASE_PLAN.md](docs/PHASE_PLAN.md) and [docs/PRODUCTION_OPERATIONS_MANUAL.md](docs/PRODUCTION_OPERATIONS_MANUAL.md).

| Surface | Served by | URL |
|---|---|---|
| Public website, client portal, shared sign-in | Next.js | `/`, `/portal`, `/login`, `/verify/risk-report/{token}` |
| Staff back-office (CRM, marketing, enablement) | Laravel + Filament v5 | `/office` |
| API | Laravel | `/api/v1` |

| Directory | Contents |
|---|---|
| [`backend/`](backend) | Laravel 13 (PHP 8.3): API, Filament back-office, Sanctum sessions, spatie/laravel-permission, TOTP 2FA |
| [`frontend/`](frontend) | Next.js 16 (App Router, TypeScript, Tailwind CSS 4): public site, client portal, sign-in |
| [`docs/`](docs) | Site audit, architecture, ERD, RBAC matrix, AI agents, research workflow, compliance-risk matrix, API, deployment, OpenAPI |
| [`deploy/`](deploy) | Nginx, Supervisor, MySQL grants, docker-compose for MySQL/Redis/Mailpit |

## Principles enforced in code

- **Regulatory status is data.** Nothing says "SEBI registered" unless a regulatory profile version has been entered, submitted and **verified by a different person**. Research publication fails closed until the profile and required disclosures are in place (`App\Domain\Compliance\ComplianceGate`).
- **No fabricated data.** Unverified contact details stay hidden; market pages show "Market data unavailable" instead of numbers; dashboards list modules not yet built as disabled instead of placeholder figures.
- **Append-only history.** Audit logs, consent records, login history, lead attributions and status history throw on update/delete.
- **Separation of duties.** Nobody changes their own roles; privileged roles need Super Admin; policies and regulatory profiles need a second person.
- **Demo data is fenced.** `is_demo` rows are hidden unless `DEMO_MODE=true` and are always excluded from dashboards; the demo seeder refuses to run in production.

## Local development

Prerequisites: PHP 8.3 (pdo_sqlite, intl, bcmath, gd), Composer 2, Node 20.9+.

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Set `DEMO_MODE=true` and `INITIAL_SUPER_ADMIN_EMAIL=you@example.test` in `backend/.env`, then:

```bash
php artisan migrate --seed
```

```bash
php artisan serve --port=8000
```

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The seeder prints the generated Super Admin password once. Demo accounts (`*@demo.example.test`, password `Demo#Password2026`) exist only when `DEMO_MODE=true`. All staff roles must enroll an authenticator app at first sign-in.

## Tests and checks

```bash
cd backend && php artisan test
```

```bash
cd frontend && npx tsc --noEmit && npm run lint && npm run build
```

## Useful commands

| Command | Purpose |
|---|---|
| `php artisan rbac:sync` | Apply `config/rbac.php` roles/permissions to the database |
| `php artisan rbac:matrix` | Regenerate [docs/RBAC_MATRIX.md](docs/RBAC_MATRIX.md) |
| `php artisan platform:create-super-admin you@company.in` | Create a Super Admin (password prompted) |
| `php artisan db:seed --class=OnboardingSeeder` | Seed the suitability questionnaire (as a draft for compliance to publish) and the agreement containers |
| `php artisan db:seed --class=DemoSeeder` | Seed clearly marked demo data (non-production only) |
| `php artisan crm:followups-sweep` | Follow-up reminders and missed marking (scheduled every 5 minutes; run `php artisan schedule:work` locally) |
| `php artisan billing:sweep` | Expire finished subscriptions, flag overdue invoices, remind staff before renewals (scheduled daily) |
| `php artisan documents:retention-sweep` | Mark expired documents and, when auto-purge is on, destroy files past retention (scheduled daily) |
| `php artisan crm:escalate-stale-leads` | Flag leads nobody has worked in time and notify owners/managers (scheduled every 15 minutes) |
| `php artisan research:track-performance` | Evaluate performance ledger, MFE/MAE, and stop/target hit detection for active recommendations (scheduled daily) |
| `php artisan market-data:snapshot {symbol}` | Fetch and store a verified market quote snapshot with SHA-256 fingerprint |
| `php artisan queue:work` | Required for CSV imports/exports (they run as queued batches) |
| `php artisan filament:optimize` | Cache panel components and icons in production (`filament:optimize-clear` after adding resources) |

## Before production

Work through [docs/CURRENT_SITE_AUDIT.md §9](docs/CURRENT_SITE_AUDIT.md) with counsel: legal entity, registration status and number (or partner RA), responsible persons, grievance officer, and policy texts. Enter them in **Admin → Regulatory profile** and **Admin → Policies**; a second authorized person verifies/approves. Then verify contact details in **Admin → Settings**. Deployment: [docs/DEPLOYMENT_ARCHITECTURE.md](docs/DEPLOYMENT_ARCHITECTURE.md).
