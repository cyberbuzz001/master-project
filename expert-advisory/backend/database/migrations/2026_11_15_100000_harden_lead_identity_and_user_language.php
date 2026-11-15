<?php

use App\Domain\Crm\PhoneNormalizer;
use App\Models\Lead;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Lead::query()->whereNotNull('mobile')->select(['id', 'mobile'])->chunkById(500, function ($leads): void {
            foreach ($leads as $lead) {
                $normalized = PhoneNormalizer::toE164($lead->mobile);
                if ($normalized !== null && $normalized !== $lead->mobile) {
                    $lead->withoutEvents(fn () => $lead->forceFill(['mobile' => $normalized])->save());
                }
            }
        });

        $duplicates = Lead::query()->whereNotNull('mobile')->select('mobile')->groupBy('mobile')->havingRaw('COUNT(*) > 1')->pluck('mobile')->all();
        if ($duplicates !== []) {
            throw new RuntimeException('Clean duplicate lead mobiles before migrating: '.implode(', ', $duplicates));
        }

        Schema::table('leads', function (Blueprint $table): void {
            $table->unique('mobile', 'leads_mobile_unique');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->string('preferred_language', 5)->default('en')->after('mobile');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('preferred_language'));
        Schema::table('leads', fn (Blueprint $table) => $table->dropUnique('leads_mobile_unique'));
    }
};
