<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('description')->nullable();
            $table->unsignedBigInteger('leader_employee_id')->nullable()->index();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->string('employee_code', 32)->unique();
            $table->string('designation')->nullable();
            $table->foreignId('team_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('reports_to_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->date('joined_on')->nullable();
            // Set only through the compliance workflow; permission alone never authorizes research approval.
            $table->boolean('is_authorized_research_person')->default(false);
            $table->foreignId('research_authorized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('research_authorized_at')->nullable();
            $table->string('status', 16)->default('active')->index();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();
        });

        Schema::table('teams', function (Blueprint $table) {
            $table->foreign('leader_employee_id')->references('id')->on('employees')->nullOnDelete();
        });

        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('client_code', 32)->unique();
            $table->unsignedBigInteger('lead_id')->nullable()->index();
            $table->string('full_name');
            $table->string('email')->nullable()->index();
            $table->string('mobile', 20)->nullable()->index();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('country', 64)->default('India');
            $table->string('onboarding_status', 32)->default('LEAD')->index();
            $table->foreignId('relationship_manager_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->boolean('is_demo')->default(false)->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('login_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email_attempted')->nullable();
            $table->string('outcome', 24)->index();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->char('device_hash', 64)->nullable();
            $table->char('request_id', 36)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
            $table->index(['ip', 'created_at']);
        });

        Schema::create('two_factor_recovery_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code_hash');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('two_factor_recovery_codes');
        Schema::dropIfExists('login_histories');
        Schema::dropIfExists('clients');
        Schema::table('teams', fn (Blueprint $table) => $table->dropForeign(['leader_employee_id']));
        Schema::dropIfExists('employees');
        Schema::dropIfExists('teams');
    }
};
