# Open-Source Reuse Evaluation

Date: 2026-09-17 · Method: GitHub API (license file, stars, last push, archived flag, `composer.json` constraints) plus vendor docs. Our stack: Laravel 13 / PHP 8.3 / Next.js 16.

## Decision rules

1. **Must run inside our codebase or behind a clean API.** Compliance gates, consent, audit and record scoping must hold for every screen; a second app with its own users and permissions breaks that.
2. **License must allow closed, commercial, client-facing use.** MIT / BSD / Apache-2.0 are fine. **AGPL-3.0** requires publishing the source of our modifications to anyone who uses the software over a network (clients use the portal) — avoided for anything we modify. **Elastic 2.0, BSL, Commons Clause, Sustainable Use** restrict hosting or selling — only acceptable for unmodified internal tools.
3. **Actively maintained** (pushed within ~6 months, not archived) and compatible with Laravel 13.

## Adopt — libraries inside the app

| Project | License | Activity | Replaces what we would build | Notes |
|---|---|---|---|---|
| [**Filament v5**](https://github.com/filamentphp/filament) | MIT | 32k★, v5.8.2 released 2026-09-15, supports Laravel 11–13 | The entire staff back-office: CRM screens, tables with filters/sorting/bulk actions, forms, **CSV import with column mapping + failed-row report**, exports, dashboard widgets and charts, notifications, mobile-responsive layout | Biggest saving (est. 60–70% of Phases 2–8 UI). Uses our `User`, `web` guard, Laravel policies and spatie permissions directly. Has built-in TOTP MFA ([docs](https://filamentphp.com/docs/5.x/users/multi-factor-authentication)); we instead reuse our already-tested login + 2FA so there is one sign-in path. |
| [**laravel/ai**](https://github.com/laravel/ai) (official Laravel AI SDK) | MIT | v0.11.2 (2026-09-03), Laravel 12/13 | Provider adapters for OpenAI, Anthropic, Gemini and others; agents with tools; structured output; embeddings | Pre-1.0, so it sits **behind** our `AIProviderInterface`; if its API changes only the adapter changes. Replaces the planned hand-written OpenAI/Gemini/Claude providers. |
| [spatie/laravel-pdf](https://github.com/spatie/laravel-pdf) | MIT | active | PDF rendering for invoices, receipts, risk-profile reports | HTML/Blade templates → PDF; we add hashing + QR verification. |
| [spatie/laravel-backup](https://github.com/spatie/laravel-backup) | MIT | active | Database + file backups, retention, notifications | We still add the restore-verification job. |
| [spatie/laravel-health](https://github.com/spatie/laravel-health) | MIT | active | System health checks and dashboard | Feeds the admin health panel. |
| [dedoc/scramble](https://github.com/dedoc/scramble) | MIT | active | Auto-generated OpenAPI from controllers/requests | Replaces the hand-maintained `openapi.yaml`. |
| [razorpay/razorpay-php](https://github.com/razorpay/razorpay-php) | MIT | official SDK | Razorpay orders + webhook signature verification | Behind our `PaymentGateway` interface. |
| Cashfree | — | [PHP SDK](https://github.com/cashfree/cashfree-pg-sdk-php) is Apache-2.0 but has very low adoption (4★) | — | Call Cashfree's REST API with Laravel's HTTP client instead; signature verification is a few lines. |
| [netflie/whatsapp-cloud-api](https://github.com/netflie/whatsapp-cloud-api) | MIT | active | Meta WhatsApp Cloud API client (templates, media, webhooks) | Behind our `WhatsAppProvider` interface so a BSP can be swapped in. |
| Laravel Horizon / Pulse | MIT | official | Queue monitoring, performance metrics | Production observability. |

## Adopt — separate services (optional, via API)

| Project | License | Use | Why separate |
|---|---|---|---|
| Python analytics service: [TA-Lib](https://github.com/TA-Lib/ta-lib-python) (BSD-2) + [pandas-ta-classic](https://github.com/xgboosted/pandas-ta-classic) (MIT) | BSD / MIT | Deterministic indicators and the backtesting lab (Phase 5) | Python's quant ecosystem is far ahead of PHP's; `phpTraderNative` exists (MIT) but was last updated Feb 2025. |
| [Chatwoot](https://github.com/chatwoot/chatwoot) | MIT outside `enterprise/` | Optional shared inbox for WhatsApp, web chat and email support (Phase 7–8) | Ruby stack; adopt only if a full agent inbox is wanted instead of the simpler ticket module. |

## Evaluated and not recommended

| Project | License / fact | Reason |
|---|---|---|
| [Krayin CRM](https://github.com/krayin/laravel-crm) | MIT, 23.9k★, v2.2.6 | A complete application (not a package) pinned to **Laravel ^12**; cannot be merged into our Laravel 13 codebase. Running it separately duplicates users, permissions and audit and cannot enforce our consent/compliance rules. Useful as a UX reference for pipelines. |
| [Relaticle](https://github.com/relaticle/relaticle) (Filament CRM) | **AGPL-3.0**, requires PHP 8.5 | AGPL obligations; PHP version above ours. |
| [Twenty](https://github.com/twentyhq/twenty) | AGPL-3.0 + commercial files | TypeScript stack, AGPL. |
| [EspoCRM](https://github.com/espocrm/espocrm), [FreeScout](https://github.com/freescout-help-desk/freescout), [InvoiceShelf](https://github.com/InvoiceShelf/InvoiceShelf) | AGPL-3.0 | AGPL; separate apps. |
| [Invoice Ninja](https://github.com/invoiceninja/invoiceninja) | Elastic License 2.0 | Separate app; invoicing must be tightly coupled to payment verification and service activation. |
| [Akaunting](https://github.com/akaunting/akaunting) | Business Source License | Use restrictions; separate app. |
| [Mautic](https://github.com/mautic/mautic) | GPL-3.0 | Heavy marketing-automation suite; our needs are consent-gated transactional sequences. |
| [n8n](https://github.com/n8n-io/n8n) | Sustainable Use License | Fine for internal integrations, but compliance-gated automation must live in-app so it cannot bypass approvals. [Activepieces](https://github.com/activepieces/activepieces) (MIT core) is the alternative if a visual integration tool is wanted later. |
| [vectorbt](https://github.com/polakowo/vectorbt) | Apache-2.0 + **Commons Clause** | Prohibits selling a service whose value derives from it. |
| [backtesting.py](https://github.com/kernc/backtesting.py) | AGPL-3.0 | AGPL. |
| [OpenBB](https://github.com/OpenBB-finance/OpenBB) | AGPL-3.0 | AGPL; also aggregates third-party data with its own terms. |

## Market data: no open-source shortcut

NSE distributes real-time data through **authorized data vendors**; unauthorized redistribution is prohibited and redistribution needs separate exchange licensing ([NSE real-time data](https://www.nseindia.com/static/market-data/real-time-data-subscription), [NSE data usage policy](https://nsearchives.nseindia.com/web/sites/default/files/inline-files/NSE_Data_Sharing&Usage_Policy.pdf)). Scraping libraries (e.g. nsepy-style scrapers) and personal broker APIs are not a licensed basis for showing data to clients. Budget for an authorized vendor (e.g. [TrueData](https://www.truedata.in/), [Global Datafeeds](https://globaldatafeeds.in/authorized-nse-bse-mcx-stock-realtime-api-provider/)) and confirm the redistribution tier with them. Our `MarketDataProviderInterface` keeps the choice swappable.

## Resulting architecture change

| Surface | Before | After |
|---|---|---|
| Public website | Next.js | Next.js (unchanged) |
| Client portal | Next.js | Next.js (unchanged) |
| Sign-in (clients and staff) | Next.js `/login` → Laravel API | Unchanged — one sign-in path, lockout and TOTP 2FA as built in Phase 1 |
| Staff back-office (admin, CRM, compliance, billing, research desk, support) | Hand-built Next.js pages | **Filament panel at `/office`**, same Laravel session, same permissions and policies |
| AI providers | Hand-written adapters | `laravel/ai` behind `AIProviderInterface` |

The Phase 1 Next.js admin and workspace pages are replaced by Filament equivalents and removed, so there is a single staff UI to maintain.
