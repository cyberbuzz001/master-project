<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_sources', function (Blueprint $table) {
            $table->id();
            $table->string('code', 48)->unique();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('vendors', function (Blueprint $table) {
            $table->id();
            $table->string('code', 48)->unique();
            $table->string('name');
            $table->decimal('cost_per_lead', 15, 2)->nullable();
            $table->string('status', 16)->default('active');
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();
        });

        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('name');
            $table->string('channel', 32)->nullable();
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('budget', 15, 2)->nullable();
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->string('status', 16)->default('active');
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('full_name');
            $table->string('mobile', 20)->nullable()->index();
            $table->string('email')->nullable()->index();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('country', 64)->nullable();
            $table->string('trading_experience', 24)->nullable();
            $table->string('demat_status', 24)->nullable();
            $table->string('broker')->nullable();
            $table->string('capital_range', 24)->nullable();
            $table->json('preferred_segments')->nullable();
            $table->boolean('equity_interest')->default(false);
            $table->boolean('options_interest')->default(false);
            $table->boolean('commodity_interest')->default(false);
            $table->string('investment_horizon', 24)->nullable();
            $table->string('risk_level_declared', 24)->nullable();
            $table->foreignId('lead_source_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->string('referral_code', 64)->nullable()->index();
            $table->string('status', 24)->default('NEW');
            $table->foreignId('assigned_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('team_leader_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('last_contacted_at')->nullable();
            $table->timestamp('next_followup_at')->nullable();
            $table->string('call_outcome', 64)->nullable();
            $table->unsignedTinyInteger('ai_score')->nullable();
            $table->string('ai_grade', 16)->nullable();
            $table->text('lead_score_explanation')->nullable();
            $table->string('ai_intent', 64)->nullable();
            $table->string('ai_sentiment', 32)->nullable();
            $table->decimal('conversion_probability', 9, 4)->nullable();
            $table->foreignId('duplicate_of_lead_id')->nullable()->constrained('leads')->nullOnDelete();
            $table->text('message')->nullable();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'next_followup_at']);
            $table->index(['assigned_employee_id', 'status']);
            $table->index('created_at');
        });

        // Append-only: first and subsequent marketing touches.
        Schema::create('lead_attributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_first_touch')->default(false);
            $table->string('form_key', 64)->nullable();
            $table->string('utm_source')->nullable();
            $table->string('utm_medium')->nullable();
            $table->string('utm_campaign')->nullable();
            $table->string('utm_term')->nullable();
            $table->string('utm_content')->nullable();
            $table->string('landing_page', 2048)->nullable();
            $table->string('referrer', 2048)->nullable();
            $table->string('referral_code', 64)->nullable();
            $table->string('vendor_code', 48)->nullable();
            $table->string('gclid')->nullable();
            $table->string('fbclid')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('captured_at');
        });

        // Append-only lifecycle history.
        Schema::create('lead_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 24)->nullable();
            $table->string('to_status', 24);
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason', 1000)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_status_histories');
        Schema::dropIfExists('lead_attributions');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('campaigns');
        Schema::dropIfExists('vendors');
        Schema::dropIfExists('lead_sources');
    }
};
