<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->string('full_name')->nullable()->change();
        });

        Schema::table('objection_scripts', function (Blueprint $table): void {
            $table->string('objection_hi')->nullable();
            $table->text('response_hi')->nullable();
            $table->text('response_ba_hi')->nullable();
            $table->text('response_sba_hi')->nullable();
            $table->text('approved_template_hi')->nullable();
        });

        Schema::table('risk_questionnaires', function (Blueprint $table): void {
            $table->string('title_hi')->nullable();
            $table->text('description_hi')->nullable();
        });

        Schema::table('risk_questions', function (Blueprint $table): void {
            $table->text('text_hi')->nullable();
            $table->text('help_text_hi')->nullable();
        });

        Schema::table('risk_question_options', function (Blueprint $table): void {
            $table->string('label_hi')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('risk_question_options', fn (Blueprint $table) => $table->dropColumn('label_hi'));
        Schema::table('risk_questions', fn (Blueprint $table) => $table->dropColumn(['text_hi', 'help_text_hi']));
        Schema::table('risk_questionnaires', fn (Blueprint $table) => $table->dropColumn(['title_hi', 'description_hi']));
        Schema::table('objection_scripts', fn (Blueprint $table) => $table->dropColumn(['objection_hi', 'response_hi', 'response_ba_hi', 'response_sba_hi', 'approved_template_hi']));
        Schema::table('leads', fn (Blueprint $table) => $table->string('full_name')->nullable(false)->change());
    }
};
