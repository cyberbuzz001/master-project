<?php

namespace App\Providers;

use App\Domain\Identity\RbacSynchronizer;
use App\Http\Responses\OfficeLogoutResponse;
use App\Models\User;
use App\Policies\ImportPolicy;
use Filament\Actions\Imports\Models\Import;
use Filament\Auth\Http\Responses\Contracts\LogoutResponse;
use Filament\Support\Facades\FilamentView;
use Filament\View\PanelsRenderHook;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(RbacSynchronizer::class);
        $this->app->bind(LogoutResponse::class, OfficeLogoutResponse::class);
    }

    public function boot(): void
    {
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        Password::defaults(function () {
            $rule = Password::min((int) config('platform.security.password_min_length'))
                ->letters()->mixedCase()->numbers()->symbols();

            return $this->app->isProduction() ? $rule->uncompromised() : $rule;
        });

        Gate::define('viewAnyLeads', fn (User $user) => $user->canAny(['leads.view_own', 'leads.view_team', 'leads.view_all']));
        Gate::policy(Import::class, ImportPolicy::class);

        FilamentView::registerRenderHook(PanelsRenderHook::HEAD_END, fn () => view('filament.head'));

        $this->configureRateLimiting();
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('login', function (Request $request) {
            $email = mb_strtolower((string) $request->input('email'));

            return [
                Limit::perMinute(5)->by('login:'.$email.'|'.$request->ip()),
                Limit::perMinute(30)->by('login-ip:'.$request->ip()),
            ];
        });

        RateLimiter::for('two-factor', fn (Request $request) => Limit::perMinute(5)->by('2fa:'.($request->hasSession() ? $request->session()->getId() : $request->ip())));

        RateLimiter::for('public-forms', fn (Request $request) => [
            Limit::perMinute(5)->by('forms-min:'.$request->ip()),
            Limit::perDay(20)->by('forms-day:'.$request->ip()),
        ]);

        // Providers retry aggressively; keep the door open but bounded, per provider and IP.
        RateLimiter::for('webhooks', fn (Request $request) => Limit::perMinute(300)->by('webhook:'.$request->route('provider').':'.$request->ip()));

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));
    }
}
