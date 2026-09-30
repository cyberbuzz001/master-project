<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 4: services, plans, subscriptions, invoices, payments and receipts.
 *
 * Money is stored in integer paise everywhere (`*_paise`). Decimal rupees are only ever a display
 * format, so totals are exact and reproducible; no float ever touches an amount.
 *
 * Invoices and receipts snapshot the entity and client details at issue time, are numbered in a gap
 * free series, and become immutable once issued — a mistake is corrected with a credit note or a
 * void, never by editing history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('name');
            $table->string('category', 32)->index(); // research|advisory|education|other
            $table->string('summary', 1000)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64)->unique();
            $table->string('name');
            $table->string('billing_cycle', 24); // one_time|monthly|quarterly|half_yearly|yearly
            $table->unsignedSmallInteger('duration_days');
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // Prices are versioned: an invoice always points at the exact price that was in force.
        Schema::create('plan_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->unsignedBigInteger('base_price_paise');
            $table->string('currency', 3)->default('INR');
            $table->string('tax_code', 32)->nullable(); // resolved against config('billing.tax_codes')
            $table->boolean('price_includes_tax')->default(false);
            $table->string('status', 16)->default('draft')->index(); // draft|published|retired
            $table->date('effective_from')->nullable();
            $table->json('inclusions')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['plan_id', 'version']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('invoice_number', 32)->unique();
            $table->foreignId('client_id')->constrained();
            $table->string('status', 24)->default('draft')->index(); // draft|issued|partially_paid|paid|overdue|void
            $table->date('invoice_date');
            $table->date('due_date');
            $table->string('currency', 3)->default('INR');
            $table->json('legal_entity_snapshot')->nullable();
            $table->json('client_snapshot');
            $table->string('place_of_supply', 64)->nullable();
            $table->unsignedBigInteger('subtotal_paise')->default(0);
            $table->unsignedBigInteger('discount_total_paise')->default(0);
            $table->unsignedBigInteger('tax_total_paise')->default(0);
            $table->unsignedBigInteger('grand_total_paise')->default(0);
            $table->unsignedBigInteger('amount_paid_paise')->default(0);
            $table->bigInteger('balance_paise')->default(0);
            $table->string('notes', 2000)->nullable();
            $table->string('void_reason', 1000)->nullable();
            $table->char('pdf_sha256', 64)->nullable();
            $table->string('verification_token', 64)->nullable()->unique();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('issued_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['client_id', 'status']);
        });

        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_version_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description');
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedBigInteger('unit_price_paise');
            $table->unsignedBigInteger('discount_paise')->default(0);
            $table->string('tax_code', 32)->nullable();
            $table->decimal('tax_rate_percent', 5, 2)->default(0);
            $table->unsignedBigInteger('taxable_paise')->default(0);
            $table->unsignedBigInteger('tax_paise')->default(0);
            $table->unsignedBigInteger('line_total_paise')->default(0);
            $table->unsignedSmallInteger('sort_order')->default(0);
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('client_id')->constrained();
            $table->foreignId('plan_version_id')->constrained();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            // A subscription only becomes active when a verified payment covers its invoice.
            $table->string('status', 24)->default('pending_activation')->index(); // pending_activation|active|paused|expired|cancelled
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable()->index();
            $table->foreignId('activated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('activated_at')->nullable();
            $table->string('cancellation_reason', 1000)->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->index(['client_id', 'status']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('client_id')->constrained();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('amount_paise');
            $table->string('currency', 3)->default('INR');
            $table->string('method', 24); // upi|neft|imps|card|netbanking|cash|cheque|gateway
            $table->string('provider', 32)->nullable(); // cashfree|razorpay|stripe|manual
            $table->string('provider_reference', 128)->nullable();
            $table->string('reference', 128)->nullable(); // UTR / cheque number as given by the client
            $table->string('status', 24)->default('pending_verification')->index(); // initiated|pending_verification|succeeded|failed|refunded
            $table->timestamp('received_at')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->string('failure_reason', 1000)->nullable();
            $table->foreignId('proof_document_id')->nullable()->constrained('documents')->nullOnDelete();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();

            $table->unique(['provider', 'provider_reference']);
            $table->index(['client_id', 'status']);
        });

        Schema::create('payment_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->string('type', 48)->index();
            $table->string('summary', 500);
            $table->json('payload')->nullable();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('occurred_at')->useCurrent();
        });

        Schema::create('receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('receipt_number', 32)->unique();
            $table->char('pdf_sha256', 64);
            $table->string('verification_token', 64)->unique();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        // Credit given to an employee for a payment, approved by someone else.
        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained();
            $table->unsignedBigInteger('amount_paise');
            $table->string('status', 16)->default('submitted')->index(); // submitted|approved|rejected
            $table->string('note', 1000)->nullable();
            $table->string('decision_reason', 1000)->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->unique(['payment_id', 'employee_id']);
        });

        // Provider callbacks: stored once, replayed safely.
        Schema::create('webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 32)->index();
            $table->string('event_id', 128);
            $table->string('event_type', 64)->nullable();
            $table->json('payload');
            $table->boolean('signature_valid')->default(false);
            $table->string('status', 24)->default('received')->index(); // received|processed|ignored|failed
            $table->string('result', 1000)->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['provider', 'event_id']);
        });

        // Gap-free document numbering, one row per series and financial year.
        Schema::create('number_series', function (Blueprint $table) {
            $table->id();
            $table->string('series', 32);
            $table->string('period', 16);
            $table->unsignedBigInteger('next_value')->default(1);
            $table->timestamps();

            $table->unique(['series', 'period']);
        });
    }

    public function down(): void
    {
        foreach ([
            'number_series', 'webhook_events', 'payment_allocations', 'receipts', 'payment_events', 'payments',
            'subscriptions', 'invoice_items', 'invoices', 'plan_versions', 'plans', 'services',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
