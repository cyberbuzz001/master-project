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
            ])
            ->renderHook(PanelsRenderHook::TOPBAR_START, fn () => config('platform.demo_mode')
                ? new HtmlString('<span class="esc-demo-pill">Demo mode — [DEMO] records are sample data</span>')
                : '')
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
