<?php

use App\Http\Controllers\Api\V1\Admin\AccessController;
use App\Http\Controllers\Api\V1\Admin\ComplianceController;
use App\Http\Controllers\Api\V1\Admin\DashboardController;
use App\Http\Controllers\Api\V1\Admin\SettingsController;
use App\Http\Controllers\Api\V1\Admin\UserController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Client\BillingController;
use App\Http\Controllers\Api\V1\Client\OnboardingController;
use App\Http\Controllers\Api\V1\Me\AccountController;
use App\Http\Controllers\Api\V1\PublicController;
use App\Http\Controllers\Api\V1\WebhookController;
use App\Http\Controllers\Api\V1\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('health', [PublicController::class, 'health']);

    // ---- Public website ------------------------------------------------------------------
    Route::prefix('public')->group(function (): void {
        Route::get('site', [PublicController::class, 'site']);
        Route::get('trust-center', [PublicController::class, 'trustCenter']);
        Route::get('policies/{slug}', [PublicController::class, 'policy'])->where('slug', '[a-z0-9\-]+');
        Route::post('leads', [PublicController::class, 'storeLead'])->middleware('throttle:public-forms');
        Route::get('verify/{token}', [PublicController::class, 'verifyDocument'])->where('token', '[a-z0-9]{40}')->middleware('throttle:public-forms');
        Route::post('grievances', [\App\Http\Controllers\Api\V1\SupportController::class, 'storePublicGrievance'])->middleware('throttle:public-forms');
        Route::get('grievances/{trackingNumber}', [\App\Http\Controllers\Api\V1\SupportController::class, 'showPublicGrievance'])->where('trackingNumber', 'GRV\-[0-9]{4}\-[0-9]{5}')->middleware('throttle:public-forms');
    });

    // ---- Payment provider callbacks --------------------------------------------------------
    // Unauthenticated by design: the provider signature is the authentication, and every event is
    // stored before it is acted on so a replay cannot take effect twice.
    Route::post('webhooks/payments/{provider}', WebhookController::class)
        ->where('provider', '[a-z]+')
        ->middleware('throttle:webhooks');

    // ---- Authentication -------------------------------------------------------------------
    Route::prefix('auth')->group(function (): void {
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('two-factor/challenge', [AuthController::class, 'twoFactorChallenge'])->middleware('throttle:two-factor');
        Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    });

    Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function (): void {
        // ---- Self-service (reachable before 2FA enrollment so users can enroll) ------------
        Route::prefix('me')->group(function (): void {
            Route::get('/', [AccountController::class, 'show']);
            Route::put('password', [AccountController::class, 'changePassword']);
            Route::post('two-factor', [AccountController::class, 'beginTwoFactor']);
            Route::post('two-factor/confirm', [AccountController::class, 'confirmTwoFactor']);
            Route::delete('two-factor', [AccountController::class, 'disableTwoFactor']);
            Route::get('sessions', [AccountController::class, 'sessions']);
            Route::delete('sessions/{sessionHash}', [AccountController::class, 'revokeSession'])->where('sessionHash', '[a-f0-9]{64}');
            Route::get('login-history', [AccountController::class, 'loginHistory']);
        });

        Route::middleware('2fa')->group(function (): void {
            // ---- Admin command center ------------------------------------------------------
            Route::prefix('admin')->group(function (): void {
                Route::get('dashboard', DashboardController::class)->middleware('can:dashboard.admin.view');

                Route::get('users', [UserController::class, 'index'])->middleware('can:users.view');
                Route::post('users', [UserController::class, 'store'])->middleware(['can:users.create', 'can:roles.assign']);
                Route::get('users/{user}', [UserController::class, 'show'])->middleware('can:users.view');
                Route::patch('users/{user}', [UserController::class, 'update'])->middleware('can:users.update');
                Route::put('users/{user}/roles', [UserController::class, 'syncRoles'])->middleware('can:roles.assign');
                Route::post('users/{user}/deactivate', [UserController::class, 'deactivate'])->middleware('can:users.deactivate');
                Route::post('users/{user}/reactivate', [UserController::class, 'reactivate'])->middleware('can:users.deactivate');
                Route::post('users/{user}/unlock', [UserController::class, 'unlock'])->middleware('can:users.update');
                Route::put('users/{user}/research-authorization', [UserController::class, 'authorizeResearchPerson'])->middleware('can:research_persons.authorize');

                Route::get('roles', [AccessController::class, 'roles'])->middleware('can:roles.view');
                Route::get('teams', [AccessController::class, 'teams'])->middleware('can:teams.view');
                Route::post('teams', [AccessController::class, 'storeTeam'])->middleware('can:teams.manage');
                Route::patch('teams/{team}', [AccessController::class, 'updateTeam'])->middleware('can:teams.manage');
                Route::get('audit-logs', [AccessController::class, 'auditLogs'])->middleware('can:audit.view');
                Route::get('login-history', [AccessController::class, 'loginHistory'])->middleware('can:users.view');

                Route::get('regulatory-profile', [ComplianceController::class, 'profileIndex'])->middleware('can:regulatory_profile.view');
                Route::post('regulatory-profile/versions', [ComplianceController::class, 'profileStore'])->middleware('can:regulatory_profile.edit');
                Route::patch('regulatory-profile/versions/{version}', [ComplianceController::class, 'profileUpdate'])->middleware('can:regulatory_profile.edit');
                Route::post('regulatory-profile/versions/{version}/submit', [ComplianceController::class, 'profileSubmit'])->middleware('can:regulatory_profile.edit');
                Route::post('regulatory-profile/versions/{version}/verify', [ComplianceController::class, 'profileVerify'])->middleware('can:regulatory_profile.verify');
                Route::post('regulatory-profile/versions/{version}/reject', [ComplianceController::class, 'profileReject'])->middleware('can:regulatory_profile.verify');
                Route::get('compliance/readiness', [ComplianceController::class, 'readiness'])->middleware('can:regulatory_profile.view');

                Route::get('policies', [ComplianceController::class, 'policyIndex'])->middleware('can:policies.view_drafts');
                Route::get('policies/versions/{version}', [ComplianceController::class, 'policyVersionShow'])->middleware('can:policies.view_drafts');
                Route::post('policies/{document:slug}/versions', [ComplianceController::class, 'policyStore'])->middleware('can:policies.edit');
                Route::post('policies/versions/{version}/approve', [ComplianceController::class, 'policyApprove'])->middleware('can:policies.approve');
                Route::post('policies/versions/{version}/publish', [ComplianceController::class, 'policyPublish'])->middleware('can:policies.publish');

                Route::get('settings', [SettingsController::class, 'index'])->middleware('can:settings.view');
                Route::put('settings', [SettingsController::class, 'update'])->middleware('can:settings.manage');
                Route::post('settings/verify', [SettingsController::class, 'verify'])->middleware('can:settings.manage');
                Route::get('system/health', [\App\Http\Controllers\Api\V1\Admin\SystemHealthController::class, 'health'])->middleware('can:system.health.view');
            });

            // ---- Employee workspace -----------------------------------------------------------
            Route::prefix('employee')->group(function (): void {
                Route::get('dashboard', [WorkspaceController::class, 'employeeDashboard'])->middleware('can:dashboard.employee.view');
                Route::get('leads', [WorkspaceController::class, 'employeeLeads'])
                    ->middleware('can:viewAnyLeads');
            });

            // ---- Client portal ----------------------------------------------------------------
            Route::prefix('client')->middleware('can:portal.access')->group(function (): void {
                Route::get('dashboard', [WorkspaceController::class, 'clientDashboard']);

                Route::get('onboarding', [OnboardingController::class, 'show']);
                Route::get('risk-questionnaire', [OnboardingController::class, 'questionnaire']);
                Route::post('risk-profile', [OnboardingController::class, 'submitAssessment']);
                Route::post('risk-profile/{uuid}/acknowledge', [OnboardingController::class, 'acknowledgeAssessment'])->where('uuid', '[0-9a-f\-]{36}');
                Route::post('agreements/{version}/accept', [OnboardingController::class, 'acceptAgreement']);
                Route::post('documents', [OnboardingController::class, 'uploadDocument']);
                Route::get('documents/{uuid}/link', [OnboardingController::class, 'documentLink'])->where('uuid', '[0-9a-f\-]{36}');

                Route::get('billing', [BillingController::class, 'index']);
                Route::get('invoices/{uuid}/pdf', [BillingController::class, 'invoicePdf'])->where('uuid', '[0-9a-f\-]{36}');
                Route::post('invoices/{uuid}/pay', [BillingController::class, 'payInvoice'])->where('uuid', '[0-9a-f\-]{36}');
                Route::get('payments/{uuid}/receipt', [BillingController::class, 'receiptPdf'])->where('uuid', '[0-9a-f\-]{36}');

                Route::get('research', [\App\Http\Controllers\Api\V1\Client\ResearchController::class, 'index']);
                Route::get('research/{uuid}', [\App\Http\Controllers\Api\V1\Client\ResearchController::class, 'show'])->where('uuid', '[0-9a-f\-]{36}');

                // Client support tickets
                Route::get('support/tickets', [\App\Http\Controllers\Api\V1\SupportController::class, 'indexTickets']);
                Route::post('support/tickets', [\App\Http\Controllers\Api\V1\SupportController::class, 'storeTicket']);
                Route::get('support/tickets/{ticketNumber}', [\App\Http\Controllers\Api\V1\SupportController::class, 'showTicket']);
                Route::post('support/tickets/{ticketNumber}/reply', [\App\Http\Controllers\Api\V1\SupportController::class, 'replyTicket']);
            });
        });
    });
});
