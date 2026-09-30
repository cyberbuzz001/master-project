<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->timestamp('escalated_at')->nullable()->after('next_followup_at')->index();
        });

        Schema::create('training_modules', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('summary')->nullable();
            $table->longText('body_markdown')->nullable();
            $table->string('content_url', 2048)->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_mandatory')->default(true);
            $table->json('role_names')->nullable(); // null = all staff
            $table->string('status', 16)->default('draft'); // draft | published | retired
            $table->unsignedSmallInteger('due_within_days')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        // Append-only: one row per user per module version.
        Schema::create('training_acknowledgements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('training_module_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('module_version');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('ip', 45)->nullable();
            $table->timestamp('acknowledged_at');

            $table->unique(['training_module_id', 'module_version', 'user_id'], 'training_ack_unique');
        });

        Schema::create('attendance_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('work_date');
            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at');
            $table->unsignedInteger('active_minutes')->default(0);
            $table->unsignedSmallInteger('requests')->default(0);
            $table->string('first_ip', 45)->nullable();
            $table->boolean('outside_office_hours')->default(false);
            $table->timestamps();

            $table->unique(['employee_id', 'work_date']);
            $table->index('work_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_days');
        Schema::dropIfExists('training_acknowledgements');
        Schema::dropIfExists('training_modules');
        Schema::table('leads', fn (Blueprint $table) => $table->dropColumn('escalated_at'));
    }
};
