<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Free Trials / Demo Management (Module 4)
        Schema::create('free_trials', function (Blueprint $table) {
            $table->id();
            $table->string('trial_code', 32)->unique();
            $table->foreignId('lead_id')->nullable()->constrained('leads')->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('trial_type', 32)->default('equity_options'); // equity, index_options, commodity, combo
            $table->text('scope_description')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->date('interim_checkin_date')->nullable();
            $table->date('review_meeting_date')->nullable();
            $table->string('status', 32)->default('requested')->index(); // requested, approved, active, completed, converted, dropped, cancelled
            $table->text('client_feedback')->nullable();
            $table->string('drop_off_reason', 64)->nullable(); // no_response, no_perceived_value, trust_concern, price_concern, payment_issue, poor_experience, service_mismatch, not_interested, other
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['employee_id', 'status', 'end_date']);
        });

        // 2. Sales Proposals & Package Closures (Module 5)
        Schema::create('sales_proposals', function (Blueprint $table) {
            $table->id();
            $table->string('proposal_number', 32)->unique();
            $table->foreignId('lead_id')->nullable()->constrained('leads')->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('plan_version_id')->nullable()->constrained('plan_versions')->nullOnDelete();
            $table->string('package_name', 128);
            $table->text('service_scope')->nullable();
            $table->unsignedInteger('duration_days')->default(90);
            $table->unsignedBigInteger('approved_service_fee_paise');
            $table->unsignedBigInteger('registration_amount_paise')->default(0);
            $table->unsignedBigInteger('discount_amount_paise')->default(0);
            $table->unsignedBigInteger('final_agreed_amount_paise');
            $table->unsignedTinyInteger('installment_count')->default(1);
            $table->string('payment_terms', 64)->default('single_payment'); // single_payment, two_installments, three_installments, custom
            $table->date('expires_at')->nullable();
            $table->string('status', 32)->default('draft')->index(); // draft, sent, accepted, rejected, expired
            $table->text('terms_and_disclaimers')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['employee_id', 'status']);
        });

        // 3. Payment Installments & Collection Schedules (Module 8)
        Schema::create('payment_installments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->foreignId('proposal_id')->nullable()->constrained('sales_proposals')->nullOnDelete();
            $table->unsignedTinyInteger('installment_number')->default(1);
            $table->date('due_date');
            $table->date('promised_date')->nullable();
            $table->unsignedBigInteger('amount_paise');
            $table->unsignedBigInteger('amount_verified_paise')->default(0);
            $table->string('status', 32)->default('due')->index(); // promised, due, recorded, confirmed, partially_settled, settled, overdue, failed
            $table->unsignedSmallInteger('reminder_attempts')->default(0);
            $table->timestamp('last_reminded_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['client_id', 'status', 'due_date']);
        });

        // 4. Extend Objection Scripts Library (Module 3)
        Schema::table('objection_scripts', function (Blueprint $table) {
            $table->string('category', 64)->default('general')->after('id')->index();
            $table->text('exact_client_statement')->nullable()->after('objection');
            $table->text('response_ba')->nullable()->after('response');
            $table->text('response_sba')->nullable()->after('response_ba');
            $table->text('likely_concern_hypothesis')->nullable()->after('response_sba');
            $table->text('required_evidence_documentation')->nullable()->after('likely_concern_hypothesis');
            $table->text('suggested_followup_action')->nullable()->after('required_evidence_documentation');
            $table->string('escalation_condition', 255)->nullable()->after('suggested_followup_action');
            $table->text('approved_template')->nullable()->after('escalation_condition');
            $table->boolean('is_demo')->default(false)->after('approved_at')->index();
        });
    }

    public function down(): void
    {
        Schema::table('objection_scripts', function (Blueprint $table) {
            $table->dropColumn([
                'category', 'exact_client_statement', 'response_ba', 'response_sba',
                'likely_concern_hypothesis', 'required_evidence_documentation',
                'suggested_followup_action', 'escalation_condition', 'approved_template', 'is_demo',
            ]);
        });

        Schema::dropIfExists('payment_installments');
        Schema::dropIfExists('sales_proposals');
        Schema::dropIfExists('free_trials');
    }
};
