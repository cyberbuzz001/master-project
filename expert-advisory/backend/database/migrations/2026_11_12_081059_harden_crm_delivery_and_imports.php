<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_conversation_messages', fn (Blueprint $table) => $table->uuid('request_key')->nullable()->unique());
        Schema::table('research_versions', function (Blueprint $table) {
            $table->string('whatsapp_template_key', 100)->nullable();
            $table->json('eligible_service_ids')->nullable();
            $table->json('eligible_trial_types')->nullable();
        });
        Schema::table('webhook_events', fn (Blueprint $table) => $table->timestamp('processing_started_at')->nullable());
        Schema::create('lead_import_previews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('uploaded_by_id')->constrained('users');
            $table->json('payload');
            $table->string('source_hash', 64);
            $table->timestamp('expires_at');
            $table->foreignId('lead_import_batch_id')->nullable()->constrained('lead_import_batches');
            $table->timestamps();
        });
        Schema::table('scheduled_actions', function (Blueprint $table) {
            $table->string('idempotency_key', 64)->nullable()->unique();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('claimed_at')->nullable();
            $table->string('provider_message_id')->nullable();
        });
        foreach (['message_logs', 'ai_conversation_messages'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->timestamp('provider_status_at')->nullable());
        }
        Schema::table('message_templates', function (Blueprint $table) {
            $table->string('provider_template_name')->nullable();
            $table->string('language_code', 16)->default('en');
            $table->string('provider_status', 32)->nullable();
            $table->timestamp('provider_checked_at')->nullable();
            $table->string('provider_header_format', 32)->nullable();
            $table->string('provider_media_id')->nullable();
            $table->string('purpose', 48)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('ai_conversation_messages', function (Blueprint $table) {
            $table->dropUnique(['request_key']);
            $table->dropColumn('request_key');
        });
        Schema::table('research_versions', fn (Blueprint $table) => $table->dropColumn(['eligible_service_ids', 'eligible_trial_types', 'whatsapp_template_key']));
        Schema::table('webhook_events', fn (Blueprint $table) => $table->dropColumn('processing_started_at'));
        foreach (['message_logs', 'ai_conversation_messages'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('provider_status_at'));
        }
        Schema::table('message_templates', fn (Blueprint $table) => $table->dropColumn(['provider_template_name', 'language_code', 'provider_status', 'provider_checked_at', 'provider_header_format', 'provider_media_id', 'purpose']));
        Schema::table('scheduled_actions', function (Blueprint $table) {
            $table->dropUnique(['idempotency_key']);
            $table->dropColumn(['idempotency_key', 'attempts', 'claimed_at', 'provider_message_id']);
        });
        Schema::dropIfExists('lead_import_previews');
    }
};
