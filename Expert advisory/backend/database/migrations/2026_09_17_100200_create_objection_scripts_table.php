<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('objection_scripts', function (Blueprint $table) {
            $table->id();
            $table->string('objection'); // e.g. "I need to think about it"
            $table->string('tag', 48)->index();
            $table->text('response');
            $table->string('status', 16)->default('draft'); // draft | approved | retired
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('objection_scripts');
    }
};
