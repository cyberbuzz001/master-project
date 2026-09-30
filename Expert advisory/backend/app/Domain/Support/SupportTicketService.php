<?php

namespace App\Domain\Support;

use App\Models\Client;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\User;
use Carbon\CarbonImmutable;
use InvalidArgumentException;

class SupportTicketService
{
    /**
     * Create a new support ticket for a client.
     *
     * @param Client $client
     * @param array<string, mixed> $data
     * @return SupportTicket
     */
    public function createTicket(Client $client, array $data): SupportTicket
    {
        $subject = trim((string) ($data['subject'] ?? ''));
        $category = trim((string) ($data['category'] ?? 'general'));
        $initialMessage = trim((string) ($data['message'] ?? ''));

        if (empty($subject) || empty($initialMessage)) {
            throw new InvalidArgumentException('Subject and initial message are required.');
        }

        if (!array_key_exists($category, SupportTicket::CATEGORIES)) {
            $category = 'general';
        }

        $ticket = SupportTicket::create([
            'client_id' => $client->id,
            'subject' => $subject,
            'category' => $category,
            'priority' => $data['priority'] ?? 'medium',
            'status' => 'open',
            'last_reply_at' => CarbonImmutable::now(),
        ]);

        SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $client->user_id,
            'is_staff_reply' => false,
            'message' => $initialMessage,
        ]);

        return $ticket;
    }

    /**
     * Append a message to an existing support ticket thread.
     */
    public function addMessage(SupportTicket $ticket, string $message, ?User $user = null, bool $isStaff = false): SupportTicketMessage
    {
        $messageText = trim($message);
        if (empty($messageText)) {
            throw new InvalidArgumentException('Message cannot be empty.');
        }

        $ticketMessage = SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $user?->id,
            'is_staff_reply' => $isStaff,
            'message' => $messageText,
        ]);

        $ticket->update([
            'last_reply_at' => CarbonImmutable::now(),
            'status' => $isStaff ? 'waiting_on_client' : 'in_progress',
        ]);

        return $ticketMessage;
    }

    /**
     * Close a support ticket.
     */
    public function closeTicket(SupportTicket $ticket): SupportTicket
    {
        $ticket->update([
            'status' => 'closed',
            'closed_at' => CarbonImmutable::now(),
        ]);

        return $ticket;
    }
}
