<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Support\GrievanceService;
use App\Domain\Support\SupportTicketService;
use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Grievance;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportController extends Controller
{
    public function __construct(
        protected GrievanceService $grievanceService,
        protected SupportTicketService $ticketService,
    ) {
    }

    /**
     * Public endpoint to submit a SEBI grievance.
     */
    public function storePublicGrievance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'complainant_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'mobile' => ['nullable', 'string', 'max:20'],
            'category' => ['required', 'string'],
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:5000'],
        ]);

        $grievance = $this->grievanceService->fileGrievance($validated);

        return response()->json([
            'data' => [
                'tracking_number' => $grievance->tracking_number,
                'status' => $grievance->status,
                'sla_due_at' => $grievance->sla_due_at->toISOString(),
                'message' => 'Grievance submitted successfully. It will be reviewed by the designated Grievance Officer within SEBI 21-day timeline.',
            ],
        ], 201);
    }

    /**
     * Public endpoint to check grievance status.
     */
    public function showPublicGrievance(string $trackingNumber): JsonResponse
    {
        $grievance = Grievance::where('tracking_number', $trackingNumber)->first();

        if (!$grievance) {
            return response()->json(['error' => 'Grievance not found'], 404);
        }

        return response()->json([
            'data' => [
                'tracking_number' => $grievance->tracking_number,
                'category' => $grievance->category,
                'subject' => $grievance->subject,
                'status' => $grievance->status,
                'status_label' => Grievance::STATUSES[$grievance->status] ?? $grievance->status,
                'sla_due_at' => $grievance->sla_due_at->toISOString(),
                'resolved_at' => $grievance->resolved_at?->toISOString(),
                'resolution_notes' => $grievance->resolution_notes,
                'is_escalated_scores' => $grievance->is_escalated_scores,
            ],
        ]);
    }

    /**
     * Authenticated client portal support tickets.
     */
    public function indexTickets(Request $request): JsonResponse
    {
        $client = Client::where('user_id', $request->user()->id)->firstOrFail();

        $tickets = SupportTicket::where('client_id', $client->id)
            ->withCount('messages')
            ->latest()
            ->paginate(20);

        return response()->json([
            'data' => $tickets->items(),
            'meta' => [
                'current_page' => $tickets->currentPage(),
                'total' => $tickets->total(),
            ],
        ]);
    }

    public function storeTicket(Request $request): JsonResponse
    {
        $client = Client::where('user_id', $request->user()->id)->firstOrFail();

        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string'],
            'message' => ['required', 'string', 'max:5000'],
            'priority' => ['nullable', 'string'],
        ]);

        $ticket = $this->ticketService->createTicket($client, $validated);

        return response()->json([
            'data' => [
                'ticket_number' => $ticket->ticket_number,
                'subject' => $ticket->subject,
                'status' => $ticket->status,
            ],
        ], 201);
    }

    public function showTicket(Request $request, string $ticketNumber): JsonResponse
    {
        $client = Client::where('user_id', $request->user()->id)->firstOrFail();

        $ticket = SupportTicket::where('client_id', $client->id)
            ->where('ticket_number', $ticketNumber)
            ->with('messages')
            ->firstOrFail();

        return response()->json(['data' => $ticket]);
    }

    public function replyTicket(Request $request, string $ticketNumber): JsonResponse
    {
        $client = Client::where('user_id', $request->user()->id)->firstOrFail();

        $ticket = SupportTicket::where('client_id', $client->id)
            ->where('ticket_number', $ticketNumber)
            ->firstOrFail();

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $message = $this->ticketService->addMessage($ticket, $validated['message'], $request->user(), false);

        return response()->json(['data' => $message], 201);
    }
}
