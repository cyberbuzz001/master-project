<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 3: risk profiling, document vault / KYC, onboarding and agreements.
 *
 * Questionnaires, agreements and documents are versioned; answers, acceptances and access logs are
 * append-only so an assessment can always be reproduced exactly as it was taken.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_questionnaires', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('title');
            $table->string('description', 1000)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('risk_questionnaire_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('risk_questionnaire_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('methodology_version', 32);
            $table->string('status', 16)->default('draft')->index(); // draft|published|retired
            // [{key, label, min_score, max_score, description, suitability}] — labels and cut-offs are configurable.
            $table->json('bands');
            $table->unsignedInteger('valid_for_days')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['risk_questionnaire_id', 'version']);
        });

        Schema::create('risk_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('risk_questionnaire_version_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64);
            $table->string('text', 1000);
            $table->string('help_text', 1000)->nullable();
            $table->string('type', 24)->default('single_choice'); // single_choice|multi_choice
            $table->unsignedSmallInteger('weight')->default(1);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_required')->default(true);

            $table->unique(['risk_questionnaire_version_id', 'code']);
        });

        Schema::create('risk_question_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('risk_question_id')->constrained()->cascadeOnDelete();
            $table->string('label', 500);
            $table->string('value', 64);
            $table->smallInteger('score')->default(0);
            $table->json('suitability_flags')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);

            $table->unique(['risk_question_id', 'value']);
        });

        Schema::create('risk_profiles', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('risk_questionnaire_version_id')->constrained();
            $table->unsignedInteger('raw_score');
            $table->unsignedInteger('max_score');
            $table->string('methodology_version', 32);
            $table->string('risk_category', 64)->index();
            $table->json('suitability_flags')->nullable();
            $table->string('status', 16)->default('submitted')->index(); // submitted|finalized|superseded
            $table->char('answers_sha256', 64);
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['client_id', 'status']);
        });

        Schema::create('risk_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('risk_profile_id')->constrained()->cascadeOnDelete();
            $table->foreignId('risk_question_id')->constrained();
            $table->string('question_code', 64);
            $table->json('selected_values');
            $table->string('answer_label', 1000);
            $table->smallInteger('score_awarded');
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['risk_profile_id', 'risk_question_id']);
        });

        Schema::create('risk_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('risk_profile_id')->constrained()->cascadeOnDelete();
            $table->string('from_category', 64);
            $table->string('to_category', 64);
            $table->string('reason', 2000);
            $table->foreignId('created_by')->constrained('users');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('owner_type', 32)->index(); // client|lead|employee|agreement|risk_report
            $table->unsignedBigInteger('owner_id')->index();
            $table->string('category', 64)->index();
            $table->string('title');
            $table->string('status', 16)->default('pending')->index(); // pending|verified|rejected|expired
            $table->string('rejection_reason', 1000)->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->string('retention_policy', 64)->nullable();
            $table->date('retain_until')->nullable();
            $table->date('document_expires_on')->nullable();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['owner_type', 'owner_id', 'category']);
        });

        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('disk', 32);
            $table->string('path', 512);
            $table->string('original_name', 255);
            $table->string('mime', 128);
            $table->unsignedBigInteger('size');
            $table->char('sha256', 64)->index();
            $table->string('scan_status', 16)->default('skipped'); // skipped|pending|clean|infected
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['document_id', 'version']);
        });

        Schema::create('document_access_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_version_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 24)->index(); // uploaded|viewed|downloaded|link_issued|verified|rejected|deleted
            $table->string('ip', 45)->nullable();
            $table->char('request_id', 36)->nullable();
            $table->string('context', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['document_id', 'created_at']);
        });

        // Identity checks recorded against a document. Numbers are never stored in the clear.
        Schema::create('kyc_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32); // pan|aadhaar|passport|voter_id|driving_licence|bank_account|address
            $table->string('identifier_masked', 64)->nullable();
            $table->char('identifier_hash', 64)->nullable()->index();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 16)->default('pending')->index(); // pending|verified|rejected
            $table->string('remarks', 1000)->nullable();
            $table->string('method', 32)->default('manual'); // manual|api
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->unique(['client_id', 'type']);
        });

        Schema::create('onboarding_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('key', 64);
            $table->string('label');
            $table->string('status', 16)->default('pending')->index(); // pending|in_progress|completed|skipped|blocked
            $table->boolean('is_required')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('notes', 1000)->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['client_id', 'key']);
        });

        Schema::create('agreements', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('title');
            $table->string('description', 1000)->nullable();
            $table->boolean('requires_client_acceptance')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('agreement_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agreement_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->longText('body_markdown');
            $table->char('body_sha256', 64);
            $table->string('status', 16)->default('draft')->index(); // draft|in_review|published|retired
            $table->date('effective_from')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['agreement_id', 'version']);
        });

        Schema::create('agreement_acceptances', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agreement_version_id')->constrained();
            $table->string('method', 32); // portal|counter_signed|offline
            $table->foreignId('accepted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->char('evidence_sha256', 64);
            $table->timestamp('accepted_at')->useCurrent();

            $table->index(['client_id', 'agreement_version_id']);
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('risk_profile_id')->nullable()->after('onboarding_status')->constrained('risk_profiles')->nullOnDelete();
            $table->string('kyc_status', 16)->default('pending')->after('risk_profile_id')->index(); // pending|in_review|verified|rejected
            $table->timestamp('onboarded_at')->nullable()->after('kyc_status');
            $table->timestamp('converted_at')->nullable()->after('onboarded_at');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('risk_profile_id');
            $table->dropColumn(['kyc_status', 'onboarded_at', 'converted_at']);
        });

        foreach ([
            'agreement_acceptances', 'agreement_versions', 'agreements', 'onboarding_steps', 'kyc_checks',
            'document_access_logs', 'document_versions', 'documents', 'risk_overrides', 'risk_answers',
            'risk_profiles', 'risk_question_options', 'risk_questions', 'risk_questionnaire_versions', 'risk_questionnaires',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
