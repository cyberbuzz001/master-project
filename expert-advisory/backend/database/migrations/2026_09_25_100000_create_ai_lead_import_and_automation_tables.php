<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Lead Import Batches (Phase 2 & 10)
        Schema::create('lead_import_batches', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('batch_code', 32)->unique();
            $table->string('original_filename');
            $table->string('import_format', 32)->default('auto_detected'); // excel, csv, text_vertical_kv, text_single_phone, text_name_phone, screenshot_ocr
            $table->foreignId('vendor_id')->nullable()->constrained('vendors')->nullOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained('campaigns')->nullOnDelete();
            $table->foreignId('uploaded_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('valid_count')->default(0);
            $table->unsignedInteger('name_and_phone_count')->default(0);
            $table->unsignedInteger('phone_only_count')->default(0);
            $table->unsignedInteger('duplicate_count')->default(0);
            $table->unsignedInteger('invalid_count')->default(0);
            $table->unsignedInteger('accepted_count')->default(0);
            $table->unsignedInteger('uncertain_ocr_count')->default(0);
            $table->unsignedInteger('consent_verified_count')->default(0);
            $table->text('consent_basis')->nullable();
            $table->boolean('consent_whatsapp')->default(false);
            $table->boolean('consent_calls')->default(false);
            $table->string('validation_report_path')->nullable();
            $table->string('status', 32)->default('completed'); // pending, preview, processing, completed, failed
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['vendor_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        // 2. Extend leads table with automation, consent & conversational state (Phases 3, 4, 5, 7)
        Schema::table('leads', function (Blueprint $table) {
            $table->foreignId('lead_import_batch_id')->nullable()->after('import_id')->constrained('lead_import_batches')->nullOnDelete();
            $table->string('communication_state', 40)->default('CONSENT_UNKNOWN')->after('status')->index();
            $table->boolean('is_ai_paused')->default(false)->after('communication_state')->index();
            $table->string('ai_conversation_state', 50)->default('INTRO_PENDING')->after('is_ai_paused')->index();
            $table->string('preferred_language', 10)->default('en')->after('ai_conversation_state');
            $table->timestamp('last_whatsapp_received_at')->nullable()->after('preferred_language');
            $table->timestamp('whatsapp_opted_out_at')->nullable()->after('last_whatsapp_received_at');
            $table->text('whatsapp_opt_in_evidence')->nullable()->after('whatsapp_opted_out_at');
            $table->timestamp('human_handoff_requested_at')->nullable()->after('whatsapp_opt_in_evidence');
            $table->text('human_handoff_reason')->nullable()->after('human_handoff_requested_at');
            $table->timestamp('demo_requested_at')->nullable()->after('human_handoff_reason');
            $table->timestamp('appointment_requested_at')->nullable()->after('demo_requested_at');
            $table->timestamp('payment_link_generated_at')->nullable()->after('appointment_requested_at');
        });

        // 3. AI WhatsApp Conversations & Messages (Phases 4 & 7)
        Schema::create('ai_conversations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->string('channel', 20)->default('whatsapp');
            $table->string('current_state', 50)->default('INTRO_PENDING')->index();
            $table->string('lead_intent', 64)->nullable();
            $table->string('sentiment', 32)->nullable();
            $table->string('urgency', 20)->default('normal'); // low, normal, high, urgent
            $table->foreignId('assigned_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->boolean('is_paused_for_human')->default(false)->index();
            $table->foreignId('paused_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('tokens_used')->default(0);
            $table->unsignedInteger('total_messages')->default(0);
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('last_activity_at')->useCurrent()->index();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['lead_id', 'channel']);
        });

        Schema::create('ai_conversation_messages', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('conversation_id')->constrained('ai_conversations')->cascadeOnDelete();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->string('direction', 12); // 'inbound', 'outbound'
            $table->string('sender_type', 24); // 'lead', 'ai_assistant', 'human_agent', 'system'
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('message_text');
            $table->string('detected_intent', 64)->nullable();
            $table->string('sentiment', 32)->nullable();
            $table->string('provider_message_id', 128)->nullable()->index();
            $table->string('delivery_status', 24)->default('sent'); // queued, sent, delivered, read, failed
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
            $table->index(['lead_id', 'created_at']);
        });

        // 4. Appointments & Demo Calendar Booking (Phases 4 & 8)
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('appointment_code', 32)->unique();
            $table->foreignId('lead_id')->nullable()->constrained('leads')->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('appointment_type', 32)->default('advisory_intro'); // advisory_intro, demo_walkthrough, portfolio_review, kyc_closing
            $table->dateTime('scheduled_start')->index();
            $table->dateTime('scheduled_end');
            $table->string('status', 32)->default('scheduled')->index(); // scheduled, confirmed, completed, rescheduled, cancelled, no_show
            $table->string('meeting_link', 1024)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['employee_id', 'scheduled_start']);
        });

        // 5. Automated Nurturing Workflows (Phase 6)
        Schema::create('automation_workflows', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('trigger_event', 64); // LEAD_IMPORTED, CONSENT_GRANTED, DEMO_REQUESTED, APPOINTMENT_REQUESTED, PAYMENT_REQUESTED, HUMAN_REQUESTED, OPT_OUT_REQUESTED
            $table->json('conditions_json')->nullable();
            $table->json('actions_json')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('quiet_hours_enabled')->default(true);
            $table->string('quiet_hours_start', 8)->default('20:00'); // 8:00 PM IST
            $table->string('quiet_hours_end', 8)->default('09:00');   // 9:00 AM IST
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('workflow_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_id')->constrained('automation_workflows')->cascadeOnDelete();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->string('status', 32)->default('running')->index(); // running, completed, paused, stopped_opt_out, failed
            $table->unsignedInteger('current_step')->default(0);
            $table->json('step_history_json')->nullable();
            $table->string('stop_reason', 255)->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['lead_id', 'status']);
        });

        Schema::create('scheduled_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workflow_run_id')->nullable()->constrained('workflow_runs')->cascadeOnDelete();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->string('action_type', 48); // send_whatsapp_template, send_followup_reminder, check_demo_status, evaluate_lead_score
            $table->json('action_payload_json')->nullable();
            $table->dateTime('scheduled_for')->index();
            $table->string('status', 24)->default('pending')->index(); // pending, executed, cancelled, failed
            $table->text('execution_error')->nullable();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'scheduled_for']);
        });

        // 6. Centralized Suppression Records (Phases 3 & 4)
        Schema::create('suppression_records', function (Blueprint $table) {
            $table->id();
            $table->string('phone_e164', 32)->nullable()->index();
            $table->string('email', 255)->nullable()->index();
            $table->string('reason', 64)->default('USER_OPT_OUT'); // USER_OPT_OUT, STOP_KEYWORD, DND_REGISTRY, COMPLAINT, UNSUBSCRIBE
            $table->string('channel', 20)->default('all'); // all, whatsapp, calls
            $table->text('evidence_text')->nullable();
            $table->string('source', 64)->default('WHATSAPP_INBOUND');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('suppressed_at')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppression_records');
        Schema::dropIfExists('scheduled_actions');
        Schema::dropIfExists('workflow_runs');
        Schema::dropIfExists('automation_workflows');
        Schema::dropIfExists('appointments');
        Schema::dropIfExists('ai_conversation_messages');
        Schema::dropIfExists('ai_conversations');

        Schema::table('leads', function (Blueprint $table) {
            $table->dropConstrainedForeignId('lead_import_batch_id');
            $table->dropColumn([
                'communication_state',
                'is_ai_paused',
                'ai_conversation_state',
                'preferred_language',
                'last_whatsapp_received_at',
                'whatsapp_opted_out_at',
                'whatsapp_opt_in_evidence',
                'human_handoff_requested_at',
                'human_handoff_reason',
                'demo_requested_at',
                'appointment_requested_at',
                'payment_link_generated_at',
            ]);
        });

        Schema::dropIfExists('lead_import_batches');
    }
};
