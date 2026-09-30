<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_templates', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('channel', 20); // 'email', 'whatsapp'
            $table->string('name');
            $table->string('subject')->nullable();
            $table->text('body');
            $table->json('variables')->nullable();
            $table->string('status', 20)->default('draft'); // draft, approved, retired
            $table->foreignId('author_id')->constrained('users');
            $table->foreignId('approved_by_id')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['channel', 'status']);
        });

        Schema::create('message_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('channel', 20); // 'email', 'whatsapp'
            $table->string('recipient_type', 30); // 'client', 'lead', 'user'
            $table->unsignedBigInteger('recipient_id')->nullable();
            $table->string('recipient_email')->nullable();
            $table->string('recipient_phone', 32)->nullable();
            $table->foreignId('template_id')->nullable()->constrained('message_templates')->nullOnDelete();
            $table->string('rendered_subject')->nullable();
            $table->text('rendered_body');
            $table->boolean('consent_verified')->default(false);
            $table->string('status', 30)->default('queued'); // sent, queued, failed, consent_refused
            $table->string('provider_message_id')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['recipient_type', 'recipient_id']);
            $table->index(['channel', 'status']);
            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_logs');
        Schema::dropIfExists('message_templates');
    }
};
