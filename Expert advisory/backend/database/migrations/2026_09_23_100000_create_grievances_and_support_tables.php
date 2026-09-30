<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SEBI Grievance Redressal Mechanism
        Schema::create('grievances', function (Blueprint $table) {
            $table->id();
            $table->string('tracking_number', 32)->unique(); // e.g. GRV-2026-0001
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->string('complainant_name');
            $table->string('email');
            $table->string('mobile', 32)->nullable();
            $table->string('category', 32); // advisory, research, billing, service, compliance, other
            $table->string('subject');
            $table->text('description');
            $table->string('status', 32)->default('new'); // new, assigned, under_review, resolved, escalated_scores
            $table->string('priority', 20)->default('medium'); // low, medium, high, critical
            $table->foreignId('assigned_to_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sla_due_at'); // 21 calendar days from filing
            $table->text('resolution_notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_escalated_scores')->default(false);
            $table->string('scores_registration_number')->nullable();
            $table->timestamps();

            $table->index(['status', 'sla_due_at']);
            $table->index(['email', 'mobile']);
        });

        // Client Support Tickets
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 32)->unique(); // e.g. TKT-2026-0001
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('subject');
            $table->string('category', 32); // billing, kyc, onboarding, technical, general
            $table->string('priority', 20)->default('medium'); // low, medium, high
            $table->string('status', 32)->default('open'); // open, in_progress, waiting_on_client, closed
            $table->foreignId('assigned_to_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_reply_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['client_id', 'status']);
        });

        Schema::create('support_ticket_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('support_ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_staff_reply')->default(false);
            $table->text('message');
            $table->json('attachments')->nullable();
            $table->timestamps();

            $table->index(['support_ticket_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('grievances');
    }
};
