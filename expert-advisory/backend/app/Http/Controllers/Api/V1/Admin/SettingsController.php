<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Platform\Settings;
use App\Http\Controllers\Controller;
use App\Http\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SettingsController extends Controller
{
    public function __construct(private readonly Settings $settings) {}

    public function index(): JsonResponse
    {
        return ApiResponse::success($this->settings->adminListing());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'values' => ['required', 'array', 'min:1'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $this->settings->update($request->user(), $data['values'], $data['reason']);

        return ApiResponse::success($this->settings->adminListing());
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate(['key' => ['required', 'string', 'max:96']]);

        $this->settings->markVerified($request->user(), $data['key']);

        return ApiResponse::success($this->settings->adminListing());
    }
}
