<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('market_data_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 32);
            $table->string('dataset', 32);
            $table->string('symbol', 32)->index();
            $table->string('exchange', 16)->default('NSE');
            $table->char('payload_sha256', 64);
            $table->json('payload');
            $table->timestamp('as_of');
            $table->timestamp('retrieved_at');
            $table->boolean('is_stale')->default(false);
            $table->timestamps();
        });

        Schema::create('research_reports', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('report_code', 32)->unique();
            $table->string('title');
            $table->string('report_type', 32)->default('technical');
            $table->string('category', 32)->default('research_report');
            $table->unsignedBigInteger('current_version_id')->nullable();
            $table->string('archive_status', 16)->default('active');
            $table->boolean('is_demo')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('research_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('research_report_id')->constrained('research_reports')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('status', 32)->default('DRAFT');
            $table->string('title');
            $table->text('summary')->nullable();
            $table->longText('body')->nullable();
            $table->json('sections')->nullable();
            $table->foreignId('author_employee_id')->constrained('employees');
            $table->unsignedBigInteger('ai_run_id')->nullable();
            $table->string('prompt_version', 64)->nullable();
            $table->foreignId('data_snapshot_id')->nullable()->constrained('market_data_snapshots')->nullOnDelete();
            $table->unsignedBigInteger('regulatory_profile_version_id')->nullable();
            $table->char('disclosure_set_hash', 64)->nullable();
            $table->char('content_hash', 64)->nullable();
            $table->foreignId('compliance_reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('compliance_reviewed_at')->nullable();
            $table->text('compliance_comment')->nullable();
            $table->foreignId('approver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('approval_comment')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->foreignId('publisher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('valid_until')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->unique(['research_report_id', 'version']);
        });

        // Add foreign key constraint from research_reports.current_version_id to research_versions.id
        Schema::table('research_reports', function (Blueprint $table) {
            $table->foreign('current_version_id')->references('id')->on('research_versions')->nullOnDelete();
        });

        Schema::create('research_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('research_version_id')->constrained('research_versions')->cascadeOnDelete();
            $table->string('instrument', 64);
            $table->string('exchange', 16)->default('NSE');
            $table->string('segment', 32)->default('EQUITY_CASH');
            $table->string('direction', 16);
            $table->decimal('entry_low', 18, 4);
            $table->decimal('entry_high', 18, 4);
            $table->decimal('stop_loss', 18, 4);
            $table->json('targets');
            $table->string('time_horizon', 64);
            $table->string('risk_classification', 32)->default('MODERATE');
            $table->decimal('risk_reward', 9, 4)->nullable();
            $table->text('invalidation_condition')->nullable();
            $table->timestamp('data_as_of')->nullable();
            $table->string('status', 32)->default('ACTIVE');
            $table->timestamps();
        });

        Schema::create('research_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('research_version_id')->constrained('research_versions')->cascadeOnDelete();
            $table->string('stage', 32);
            $table->string('action', 32);
            $table->foreignId('actor_user_id')->constrained('users');
            $table->foreignId('actor_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->text('comments')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('disclosure_bindings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('research_version_id')->constrained('research_versions')->cascadeOnDelete();
            $table->unsignedBigInteger('regulatory_profile_version_id');
            $table->json('disclosures');
            $table->char('disclosure_hash', 64);
            $table->boolean('conflict_of_interest_declared')->default(false);
            $table->text('conflict_details')->nullable();
            $table->timestamps();
        });

        Schema::create('research_performance', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recommendation_id')->constrained('research_recommendations')->cascadeOnDelete();
            $table->timestamp('published_at');
            $table->decimal('entry_ref', 18, 4);
            $table->decimal('high_after', 18, 4)->nullable();
            $table->decimal('low_after', 18, 4)->nullable();
            $table->decimal('close_ref', 18, 4)->nullable();
            $table->decimal('mfe', 18, 4)->nullable();
            $table->decimal('mae', 18, 4)->nullable();
            $table->string('outcome', 32)->default('PENDING');
            $table->string('methodology_version', 32)->default('v1.0');
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('research_distributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('research_version_id')->constrained('research_versions')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('channel', 16)->default('PORTAL');
            $table->timestamp('sent_at')->nullable();
            $table->string('delivery_status', 32)->default('QUEUED');
            $table->string('skip_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('research_distributions');
        Schema::dropIfExists('research_performance');
        Schema::dropIfExists('disclosure_bindings');
        Schema::dropIfExists('research_approvals');
        Schema::dropIfExists('research_recommendations');
        Schema::table('research_reports', function (Blueprint $table) {
            $table->dropForeign(['current_version_id']);
        });
        Schema::dropIfExists('research_versions');
        Schema::dropIfExists('research_reports');
        Schema::dropIfExists('market_data_snapshots');
    }
};
