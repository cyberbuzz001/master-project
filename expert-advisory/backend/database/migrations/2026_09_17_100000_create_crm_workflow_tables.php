<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->foreignId('import_id')->nullable()->after('referral_code')->constrained('imports')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable()->after('assigned_employee_id');
            $table->timestamp('dnd_at')->nullable()->after('status');
        });

        Schema::table('vendors', function (Blueprint $table) {
            $table->string('contact_name')->nullable()->after('name');
            $table->string('contact_email')->nullable()->after('contact_name');
            $table->string('contact_phone', 32)->nullable()->after('contact_email');
            // How the vendor obtained consent from the people it supplies. Required before importing their leads.
            $table->text('consent_basis')->nullable()->after('cost_per_lead');
        });

        Schema::table('campaigns', function (Blueprint $table) {
            $table->string('landing_page_url', 2048)->nullable()->after('channel');
            $table->text('notes')->nullable()->after('status');
        });

        // Append-only unified timeline for a lead.
        Schema::create('lead_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32); // note | call | status_changed | assigned | followup_scheduled | followup_completed | followup_missed | imported | captured | duplicate_flag
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('summary', 500);
            $table->json('details')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['lead_id', 'occurred_at']);
        });

        // Append-only assignment history.
        Schema::create('lead_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('to_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('method', 16); // manual | auto | import
            $table->string('reason', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('call_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained()->nullOnDelete();
            $table->string('direction', 8)->default('outbound');
            $table->string('outcome', 32); // connected | no_answer | busy | switched_off | wrong_number | callback_requested | not_interested
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('called_at');
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['employee_id', 'called_at']);
        });

        Schema::create('followups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained()->nullOnDelete();
            $table->string('channel', 16)->default('call'); // call | whatsapp | email | meeting
            $table->timestamp('due_at');
            $table->string('status', 16)->default('pending'); // pending | done | missed | cancelled
            $table->text('notes')->nullable();
            $table->string('outcome', 500)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('reminded_at')->nullable();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['employee_id', 'status', 'due_at']);
            $table->index(['status', 'due_at']);
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->foreignId('assignee_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->nullableMorphs('taskable');
            $table->string('priority', 8)->default('normal'); // low | normal | high
            $table->string('status', 16)->default('open'); // open | done | cancelled
            $table->timestamp('due_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['assignee_employee_id', 'status', 'due_at']);
        });

        Schema::create('referral_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('label');
            $table->foreignId('owner_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('referrer_client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            // Rewards stay disabled until compliance approves a reward policy (see COMPLIANCE_RISK_MATRIX R17).
            $table->boolean('reward_enabled')->default(false);
            $table->unsignedInteger('clicks')->default(0);
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_codes');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('followups');
        Schema::dropIfExists('call_logs');
        Schema::dropIfExists('lead_assignments');
        Schema::dropIfExists('lead_activities');

        Schema::table('campaigns', fn (Blueprint $table) => $table->dropColumn(['landing_page_url', 'notes']));
        Schema::table('vendors', fn (Blueprint $table) => $table->dropColumn(['contact_name', 'contact_email', 'contact_phone', 'consent_basis']));
        Schema::table('leads', function (Blueprint $table) {
            $table->dropConstrainedForeignId('import_id');
            $table->dropColumn(['assigned_at', 'dnd_at']);
        });
    }
};
