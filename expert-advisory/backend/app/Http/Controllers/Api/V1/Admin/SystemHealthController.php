<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\RegulatoryProfileVersion;
use Carbon\CarbonImmutable;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class SystemHealthController extends Controller
{
    public function health(): JsonResponse
    {
        $components = [];
        $overallHealthy = true;

        // 1. Database check
        $dbStart = microtime(true);
        try {
            DB::select('SELECT 1');
            $dbLatencyMs = (int) round((microtime(true) - $dbStart) * 1000);
            $components['database'] = [
                'status' => 'healthy',
                'latency_ms' => $dbLatencyMs,
            ];
        } catch (Exception $e) {
            $overallHealthy = false;
            $components['database'] = [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
            ];
        }

        // 2. Cache check
        try {
            $cacheKey = 'health_check_' . bin2hex(random_bytes(4));
            Cache::put($cacheKey, 'ok', 10);
            $cacheVal = Cache::get($cacheKey);
            Cache::forget($cacheKey);

            $components['cache'] = [
                'status' => $cacheVal === 'ok' ? 'healthy' : 'degraded',
                'store' => config('cache.default'),
            ];
        } catch (Exception $e) {
            $components['cache'] = [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
            ];
        }

        // 3. Document Vault Private Storage
        try {
            $disk = Storage::disk(config('onboarding.documents.disk', 'local'));
            $testFile = '.health_' . bin2hex(random_bytes(4));
            $disk->put($testFile, 'health');
            $disk->delete($testFile);

            $components['vault_storage'] = [
                'status' => 'healthy',
                'disk' => config('onboarding.documents.disk', 'local'),
            ];
        } catch (Exception $e) {
            $overallHealthy = false;
            $components['vault_storage'] = [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
            ];
        }

        // 4. Regulatory Profile Status
        $activeProfile = RegulatoryProfileVersion::where('status', 'verified')->latest('verified_at')->first();
        $components['compliance_profile'] = [
            'status' => $activeProfile ? 'verified' : 'pending_verification',
            'legal_entity' => $activeProfile?->legal_entity_name,
            'registration_number' => $activeProfile?->registration_number,
        ];

        // 5. System metrics
        $components['system'] = [
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'server_time' => CarbonImmutable::now()->toISOString(),
            'environment' => app()->environment(),
        ];

        return response()->json([
            'status' => $overallHealthy ? 'healthy' : 'degraded',
            'timestamp' => CarbonImmutable::now()->toISOString(),
            'components' => $components,
        ], $overallHealthy ? 200 : 503);
    }
}
