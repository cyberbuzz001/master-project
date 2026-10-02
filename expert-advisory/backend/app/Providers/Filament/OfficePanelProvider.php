<?php

namespace App\Providers\Filament;

use App\Http\Middleware\EnforceWorkforcePolicies;
use App\Http\Middleware\EnsureOfficeSessionIsSecure;
use App\Http\Middleware\OfficeAuthenticate;
use Filament\Actions\Action;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Navigation\NavigationGroup;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Support\Icons\Heroicon;
use Filament\View\PanelsRenderHook;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\HtmlString;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/**
 * Staff back-office (admin, CRM, compliance). Public site and client portal stay in Next.js.
 */
class OfficePanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('office')
            ->path('office')
            ->brandName('Expert Stocks · Office')
            ->brandLogo(fn () => new HtmlString(view('filament.brand')->render()))
            ->brandLogoHeight('2rem')
            ->favicon(asset('favicon.svg'))
            ->colors([
                'primary' => Color::hex('#1f56d6'),
                'info' => Color::Sky,
                'success' => Color::Emerald,
                'warning' => Color::Amber,
                'danger' => Color::Rose,
                'gray' => Color::Slate,
            ])
            ->font('Plus Jakarta Sans')
            ->darkMode(false)
            ->sidebarCollapsibleOnDesktop()
            ->maxContentWidth('full')
            ->databaseNotifications()
            ->databaseNotificationsPolling('60s')
            ->globalSearchKeyBindings(['command+k', 'ctrl+k'])
            ->unsavedChangesAlerts()
            ->navigationGroups([
                NavigationGroup::make('CRM')->icon(Heroicon::OutlinedUserGroup),
                NavigationGroup::make('Clients')->icon(Heroicon::OutlinedIdentification),
                NavigationGroup::make('Billing')->icon(Heroicon::OutlinedBanknotes),
                NavigationGroup::make('Research Desk')->icon(Heroicon::OutlinedChartBar),
                NavigationGroup::make('Sales enablement')->icon(Heroicon::OutlinedLightBulb)->collapsed(),
                NavigationGroup::make('Marketing')->icon(Heroicon::OutlinedMegaphone)->collapsed(),
                NavigationGroup::make('Workforce')->icon(Heroicon::OutlinedBriefcase)->collapsed(),
                NavigationGroup::make('Compliance')->icon(Heroicon::OutlinedShieldCheck),
                NavigationGroup::make('Administration')->icon(Heroicon::OutlinedCog6Tooth)->collapsed(),
            ])
            ->userMenuItems([
                Action::make('security')
                    ->label('Account security')
                    ->icon(Heroicon::OutlinedKey)
                    ->url(fn () => config('platform.frontend_url').'/account/security'),
                Action::make('tradegrow_desk')
                    ->label('TradeGrow RMS / War Room Desk')
                    ->icon(Heroicon::OutlinedArrowTopRightOnSquare)
                    ->url(fn () => env('TRADEGROW_ADMIN_URL', 'https://tradegrowx.in/admin'))
                    ->openUrlInNewTab(),
            ])
            ->renderHook(PanelsRenderHook::TOPBAR_START, fn () => config('platform.demo_mode')
                ? new HtmlString('<span class="esc-demo-pill">Demo mode — [DEMO] records are sample data</span>')
                : '')
            ->renderHook(PanelsRenderHook::TOPBAR_END, fn () => new HtmlString(
                '<a href="' . e(env('TRADEGROW_ADMIN_URL', 'https://tradegrowx.in/admin')) . '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;color:#0ea5e9;background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.25);text-decoration:none;margin-right:12px;transition:all 0.2s;" onmouseover="this.style.background=\'rgba(14,165,233,0.18)\'" onmouseout="this.style.background=\'rgba(14,165,233,0.08)\'">' .
                '<svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>' .
                'TradeGrow RMS Desk ↗</a>'
            ))
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\Filament\Pages')
            ->pages([Dashboard::class])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\Filament\Widgets')
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                PreventRequestForgery::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                OfficeAuthenticate::class,
                EnsureOfficeSessionIsSecure::class,
            ], isPersistent: true)
            // Page requests only (not Livewire updates), after authentication.
            ->authMiddleware([
                EnforceWorkforcePolicies::class,
            ]);
    }
}
