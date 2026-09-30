<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('regulatory_profile_versions', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('version')->unique();
            $table->string('status', 24)->default('draft')->index(); // draft | pending_verification | verified | superseded | rejected
            $table->string('entity_type', 40);
            $table->string('legal_entity_name')->nullable();
            $table->string('brand_name')->nullable();
            $table->string('research_status')->nullable();
            $table->string('registration_number', 64)->nullable();
            $table->date('registration_date')->nullable();
            $table->date('registration_valid_until')->nullable();
            $table->string('ra_name')->nullable();
            $table->string('ra_contact_email')->nullable();
            $table->string('ra_contact_phone', 32)->nullable();
            $table->string('principal_officer')->nullable();
            $table->string('compliance_officer')->nullable();
            $table->string('grievance_officer_name')->nullable();
            $table->string('grievance_officer_email')->nullable();
            $table->string('grievance_officer_phone', 32)->nullable();
            $table->json('raasb_details')->nullable();
            $table->json('partner_ra')->nullable();
            $table->json('authorized_persons')->nullable();
            $table->json('applicable_disclosures')->nullable();
            $table->json('advertising_rules')->nullable();
            $table->boolean('research_approval_required')->default(true);
            $table->boolean('personalized_advice_allowed')->default(false);
            $table->string('performance_claim_policy', 24)->default('none'); // none | ledger_only
            $table->json('whatsapp_policy')->nullable();
            $table->json('email_policy')->nullable();
            $table->text('public_statement')->nullable(); // wording shown on the website once verified
            $table->date('review_due_at')->nullable();
            $table->string('verification_evidence', 1000)->nullable();
            $table->string('rejection_reason', 1000)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->timestamps();
        });

        Schema::create('policy_documents', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 64)->unique();
            $table->string('title');
            $table->string('category', 32)->default('legal'); // legal | disclosure | regulation | internal
            $table->boolean('is_public')->default(true);
            $table->boolean('requires_consent')->default(false);
            $table->timestamps();
        });

        Schema::create('policy_document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('policy_document_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->string('status', 24)->default('draft')->index(); // draft | approved | published | superseded
            $table->longText('body_markdown');
            $table->char('content_hash', 64);
            $table->string('change_summary', 1000)->nullable();
            $table->date('effective_from')->nullable();
            $table->date('review_due_at')->nullable();
            $table->string('source_url', 2048)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->timestamps();

            $table->unique(['policy_document_id', 'version']);
        });

        // Append-only. Current consent = latest row per (subject, purpose).
        Schema::create('consent_records', function (Blueprint $table) {
            $table->id();
            $table->string('subject_type', 32);
            $table->unsignedBigInteger('subject_id');
            $table->string('purpose', 40);
            $table->boolean('granted');
            $table->string('channel', 24);
            $table->foreignId('policy_document_version_id')->nullable()->constrained()->nullOnDelete();
            $table->char('consent_text_hash', 64);
            $table->string('consent_text', 2000);
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->char('request_id', 36)->nullable();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamp('captured_at');

            $table->index(['subject_type', 'subject_id', 'purpose', 'captured_at'], 'consent_lookup_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consent_records');
        Schema::dropIfExists('policy_document_versions');
        Schema::dropIfExists('policy_documents');
        Schema::dropIfExists('regulatory_profile_versions');
    }
};
