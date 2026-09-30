<?php

namespace App\Domain\Ai;

use App\Domain\MarketData\MarketDataSnapshotService;
use App\Models\Client;
use App\Models\Lead;
use App\Models\MarketDataSnapshot;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;
use RuntimeException;

class ToolGateway
{
    public function __construct(
        protected ?MarketDataSnapshotService $marketDataService = null,
    ) {
    }

    /**
     * @return array<int, array{name: string, description: string, parameters: array<string, mixed>}>
     */
    public function getToolDefinitions(): array
    {
        return [
            [
                'name' => 'get_market_snapshot',
                'description' => 'Retrieve verified market snapshot and quote for a given equity symbol',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'symbol' => ['type' => 'string', 'description' => 'NSE/BSE symbol e.g. RELIANCE, TCS, INFY'],
                    ],
                    'required' => ['symbol'],
                ],
            ],
            [
                'name' => 'get_lead_summary',
                'description' => 'Retrieve CRM lead details and timeline summary',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'lead_id' => ['type' => 'integer', 'description' => 'ID of the lead'],
                    ],
                    'required' => ['lead_id'],
                ],
            ],
            [
                'name' => 'get_client_summary',
                'description' => 'Retrieve client status, risk profile band, and active subscription',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'client_id' => ['type' => 'integer', 'description' => 'ID of the client'],
                    ],
                    'required' => ['client_id'],
                ],
            ],
        ];
    }

    /**
     * Execute a tool call on behalf of the requesting user.
     * Enforces strict authorization so an assistant cannot read data the user cannot see.
     *
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    public function execute(string $toolName, array $arguments, ?User $user = null): array
    {
        return match ($toolName) {
            'get_market_snapshot' => $this->getMarketSnapshot($arguments, $user),
            'get_lead_summary' => $this->getLeadSummary($arguments, $user),
            'get_client_summary' => $this->getClientSummary($arguments, $user),
            default => throw new InvalidArgumentException("Unknown or disallowed tool: {$toolName}"),
        };
    }

    /**
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    protected function getMarketSnapshot(array $arguments, ?User $user): array
    {
        $symbol = strtoupper(trim((string) ($arguments['symbol'] ?? '')));
        if (empty($symbol)) {
            return ['error' => 'Symbol is required', 'source' => 'system'];
        }

        $snapshot = MarketDataSnapshot::where('symbol', $symbol)
            ->latest('as_of')
            ->first();

        if (!$snapshot) {
            return [
                'symbol' => $symbol,
                'status' => 'not_found',
                'message' => 'Insufficient verified data.',
                'as_of' => now()->toISOString(),
            ];
        }

        $payload = $snapshot->payload ?? [];
        $ltp = (float) ($payload['ltp'] ?? 0);
        $pricePaise = (int) round($ltp * 100);

        return [
            'symbol' => $snapshot->symbol,
            'price_paise' => $pricePaise,
            'price_inr' => $ltp,
            'volume' => $payload['volume'] ?? 0,
            'as_of' => $snapshot->as_of?->toISOString(),
            'sha256' => $snapshot->payload_sha256,
            'is_stale' => (bool) $snapshot->is_stale,
        ];
    }

    /**
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    protected function getLeadSummary(array $arguments, ?User $user): array
    {
        $leadId = (int) ($arguments['lead_id'] ?? 0);
        $lead = Lead::find($leadId);

        if (!$lead) {
            return ['error' => 'Lead not found'];
        }

        if ($user && !Gate::forUser($user)->check('view', $lead) && !Gate::forUser($user)->check('leads.view_all')) {
            throw new RuntimeException('Unauthorized: You do not have permission to access this lead.');
        }

        return [
            'id' => $lead->id,
            'name' => $lead->name,
            'status' => $lead->status,
            'source' => $lead->source?->name ?? 'Unknown',
            'created_at' => $lead->created_at->toISOString(),
            'last_contacted_at' => $lead->last_contacted_at?->toISOString(),
        ];
    }

    /**
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    protected function getClientSummary(array $arguments, ?User $user): array
    {
        $clientId = (int) ($arguments['client_id'] ?? 0);
        $client = Client::with(['currentRiskProfile', 'activeSubscription.plan'])->find($clientId);

        if (!$client) {
            return ['error' => 'Client not found'];
        }

        if ($user && !Gate::forUser($user)->check('clients.view_all') && $client->user_id !== $user->id) {
            throw new RuntimeException('Unauthorized: You do not have permission to access this client.');
        }

        return [
            'id' => $client->id,
            'client_code' => $client->client_code,
            'name' => $client->name,
            'onboarding_status' => $client->onboarding_status,
            'risk_band' => $client->currentRiskProfile?->category,
            'active_plan' => $client->activeSubscription?->plan?->name,
            'is_active' => $client->onboarding_status === 'active',
        ];
    }
}
