<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('imports', function (Blueprint $table) {
            $table->timestamp('rolled_back_at')->nullable()->after('completed_at');
            $table->foreignId('rolled_back_by')->nullable()->after('rolled_back_at')->constrained('users')->nullOnDelete();
            $table->unsignedInteger('rolled_back_rows')->nullable()->after('rolled_back_by');
        });
    }

    public function down(): void
    {
        Schema::table('imports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('rolled_back_by');
            $table->dropColumn(['rolled_back_at', 'rolled_back_rows']);
        });
    }
};
