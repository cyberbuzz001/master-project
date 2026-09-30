<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('label')->nullable()->after('name');
            $table->boolean('is_staff')->default(true)->after('guard_name');
            $table->boolean('requires_2fa')->default(true)->after('is_staff');
            $table->boolean('is_privileged')->default(false)->after('requires_2fa');
        });

        Schema::table('permissions', function (Blueprint $table) {
            $table->string('module', 32)->nullable()->after('name')->index();
            $table->string('label')->nullable()->after('module');
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['label', 'is_staff', 'requires_2fa', 'is_privileged']);
        });

        Schema::table('permissions', function (Blueprint $table) {
            $table->dropIndex(['module']);
            $table->dropColumn(['module', 'label']);
        });
    }
};
