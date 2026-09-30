<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('risk_profile_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('report_number', 32)->unique();
            $table->char('pdf_sha256', 64);
            $table->string('verification_token', 64)->unique();
            $table->foreignId('document_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_reports');
    }
};
