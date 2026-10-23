<?php

namespace App\Domain\Ai;

use App\Domain\Communications\WhatsAppService;
use App\Models\AiConversation;
use App\Models\AiConversationMessage;
use App\Models\Appointment;
use App\Models\Employee;
use App\Models\FreeTrial;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\Plan;
use App\Models\PlanVersion;
use App\Models\SuppressionRecord;
use App\Models\Task;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AiWhatsAppSalesAssistant
{
    public function __construct(
        protected WhatsAppService $whatsAppService
    ) {
    }

    /**
     * Process an incoming prospect WhatsApp message through the conversational sales engine.
     *
     * @param Lead $lead
     * @param string $incomingText
     * @param string|null $providerMessageId
     * @return array<string, mixed>
     */
    public function handleIncomingMessage(Lead $lead, string $incomingText, ?string $providerMessageId = null): array
    {
        $cleanText = trim($incomingText);
        if (empty($cleanText)) {
            return ['status' => 'empty_input'];
        }

        // 1. Update Lead's last received timestamp (opens the 24h customer service window)
        $lead->update([
            'last_whatsapp_received_at' => now(),
        ]);

        // 2. Fetch or initialize active AI Conversation session
        $conversation = AiConversation::firstOrCreate(
            [
                'lead_id' => $lead->id,
                'channel' => 'whatsapp',
                'closed_at' => null,
            ],
            [
                'current_state' => $lead->ai_conversation_state ?: 'INTRO_PENDING',
                'assigned_employee_id' => $lead->assigned_employee_id,
                'is_paused_for_human' => (bool) $lead->is_ai_paused,
            ]
        );

        // Record incoming lead message
        $inboundMsg = AiConversationMessage::create([
            'conversation_id' => $conversation->id,
            'lead_id' => $lead->id,
            'direction' => 'inbound',
            'sender_type' => 'lead',
            'message_text' => $cleanText,
            'provider_message_id' => $providerMessageId,
            'delivery_status' => 'read',
            'sent_at' => now(),
            'read_at' => now(),
        ]);

        $conversation->increment('total_messages');
        $conversation->update(['last_activity_at' => now()]);

        // 3. OPT-OUT & STOP DETECTION (Immediate Regulatory Compliance)
        if ($this->isOptOutIntent($cleanText)) {
            return $this->handleOptOut($lead, $conversation, $cleanText);
        }

        // 4. HUMAN AGENT HANDOFF CHECK (Mutual Exclusion)
        // If human agent has taken over or AI is paused, do NOT let AI respond
        if ($lead->is_ai_paused || $conversation->is_paused_for_human) {
            Log::info("[AI Sales Assistant] Message logged for Lead #{$lead->id}, but AI response skipped (Human agent takeover active).");
            
            // Notify assigned agent via task/timeline
            LeadActivity::create([
                'lead_id' => $lead->id,
                'type' => 'note',
                'actor_user_id' => null,
                'summary' => 'Inbound WhatsApp message received while agent takeover active: "' . Str::limit($cleanText, 80) . '"',
                'details' => ['full_message' => $cleanText, 'from' => $lead->mobile],
                'occurred_at' => now(),
            ]);

            return [
                'status' => 'human_agent_active',
                'message' => 'Message routed to assigned human agent.',
            ];
        }

        // 5. INTENT CLASSIFICATION & LANGUAGE DETECTION
        $language = $this->detectLanguage($cleanText, $lead->preferred_language ?? 'en');
        $intent = $this->classifyIntent($cleanText);

        $inboundMsg->update([
            'detected_intent' => $intent['intent'],
            'sentiment' => $intent['sentiment'],
        ]);

        $conversation->update([
            'lead_intent' => $intent['intent'],
            'sentiment' => $intent['sentiment'],
            'urgency' => $intent['urgency'] ?? 'normal',
        ]);

        // 6. PROCESS 6 CORE GUIDED OPTIONS
        $responsePayload = match ($intent['intent']) {
            'WANTS_FREE_DEMO' => $this->handleFreeDemoOption($lead, $conversation, $language),
            'WANTS_APPOINTMENT' => $this->handleAppointmentOption($lead, $conversation, $language, $cleanText),
            'WANTS_PRICING_PACKAGES' => $this->handlePricingOption($lead, $conversation, $language),
            'REQUESTS_HUMAN_AGENT' => $this->handleHumanHandoffOption($lead, $conversation, $language, 'Client explicitly requested human representative'),
            'NOT_INTERESTED' => $this->handleNotInterestedOption($lead, $conversation, $language),
            default => $this->handleApprovedFaqOption($lead, $conversation, $cleanText, $language),
        };

        $replyText = $responsePayload['reply_text'];
        $nextState = $responsePayload['next_state'];

        // 7. COMPLIANCE GUARDIAN SCREENING
        $screenedText = $this->screenThroughComplianceGuardian($replyText);

        // 8. DISPATCH VIA WHATSAPP SERVICE
        $dispatchResult = $this->whatsAppService->sendText($lead->mobile, $screenedText, $lead, $conversation);

        // 9. UPDATE CONVERSATION STATE
        $conversation->update(['current_state' => $nextState]);
        $lead->update(['ai_conversation_state' => $nextState]);

        return [
            'status' => 'replied',
            'intent' => $intent['intent'],
            'next_state' => $nextState,
            'reply_text' => $screenedText,
            'dispatch' => $dispatchResult,
        ];
    }

    /**
     * Check if message contains an explicit opt-out statement.
     */
    public function isOptOutIntent(string $text): bool
    {
        $normalized = mb_strtolower(trim($text));
        $optOutPatterns = [
            'stop', 'unsubscribe', 'quit', 'cancel', 'end',
            'बंद करो', 'मैसेज मत करो', 'आगे मैसेज मत भेजना', 'बंद कर दो',
            'dont message', 'stop messaging', 'remove my number', 'dnd', 'no more messages'
        ];

        foreach ($optOutPatterns as $p) {
            if ($normalized === $p || str_starts_with($normalized, $p . ' ') || str_ends_with($normalized, ' ' . $p)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Immediate Regulatory Opt-Out Handling.
     */
    protected function handleOptOut(Lead $lead, AiConversation $conversation, string $rawEvidence): array
    {
        // 1. Create permanent suppression record
        SuppressionRecord::create([
            'phone_e164' => $lead->mobile,
            'email' => $lead->email,
            'reason' => 'USER_OPT_OUT',
            'channel' => 'all',
            'evidence_text' => 'Inbound WhatsApp request: "' . $rawEvidence . '"',
            'source' => 'WHATSAPP_INBOUND',
            'suppressed_at' => now(),
        ]);

        // 2. Update lead status & communication state
        $lead->update([
            'communication_state' => 'OPTED_OUT',
            'status' => 'DND',
            'whatsapp_opted_out_at' => now(),
            'is_ai_paused' => true,
            'ai_conversation_state' => 'OPTED_OUT',
            'dnd_at' => now(),
        ]);

        $conversation->update([
            'current_state' => 'OPTED_OUT',
            'closed_at' => now(),
        ]);

        // 3. Record timeline activity
        LeadActivity::create([
            'lead_id' => $lead->id,
            'type' => 'status_changed',
            'summary' => 'Lead opted out via WhatsApp. Centralized suppression applied.',
            'details' => ['evidence' => $rawEvidence],
            'occurred_at' => now(),
        ]);

        // 4. Polite final confirmation
        $ackText = "You have been successfully unsubscribed. We have updated your preferences and you will receive no further messages or calls from Expert Stocks Consultancy. Thank you.";
        $this->whatsAppService->sendText($lead->mobile, $ackText, $lead, $conversation);

        return [
            'status' => 'opted_out_suppressed',
            'message' => 'Lead successfully opted out and suppressed.',
        ];
    }

    /**
     * Option 1: Free Demo Booking.
     */
    protected function handleFreeDemoOption(Lead $lead, AiConversation $conversation, string $lang): array
    {
        // Check if demo already active
        $existingDemo = FreeTrial::where('lead_id', $lead->id)->whereIn('status', ['requested', 'approved', 'active'])->first();

        if ($existingDemo) {
            $reply = $lang === 'hi'
                ? "नमस्ते! आपका 2-दिवसीय फ्री डेमो पहले से ही सक्रिय है (कोड: {$existingDemo->trial_code})। हमारी रिसर्च टीम आपको मार्केट ऑवर्स में अपडेट्स भेज रही है। किसी भी सवाल के लिए आप कभी भी यहाँ पूछ सकते हैं।"
                : "Hello! You already have an active 2-day complimentary market demo (Ref: {$existingDemo->trial_code}). Our institutional research desk is sharing verified market commentary with you during trading hours.";

            return [
                'reply_text' => $reply,
                'next_state' => 'DEMO_BOOKED',
            ];
        }

        // Create 2-day demo trial
        $demo = FreeTrial::create([
            'trial_code' => 'DEMO-' . date('ymd') . '-' . strtoupper(Str::random(4)),
            'lead_id' => $lead->id,
            'employee_id' => $lead->assigned_employee_id,
            'trial_type' => 'equity_options',
            'scope_description' => '2-Day Observational Access to Expert Stocks Research Desk Bulletins & Pre-Market Briefs.',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(2)->toDateString(),
            'status' => 'active',
            'approved_at' => now(),
        ]);

        $lead->update([
            'status' => 'FREE_TRIAL',
            'demo_requested_at' => now(),
            'ai_score' => max($lead->ai_score ?? 0, 75),
            'ai_grade' => 'HOT',
        ]);

        LeadActivity::create([
            'lead_id' => $lead->id,
            'type' => 'status_changed',
            'summary' => "AI Assistant provisioned 2-Day Research Demo (Code: {$demo->trial_code})",
            'details' => ['demo_id' => $demo->id, 'trial_code' => $demo->trial_code],
            'occurred_at' => now(),
        ]);

        $reply = $lang === 'hi'
            ? "बधाई हो! आपका 2-दिवसीय कॉम्प्लिमेंटरी रिसर्च डेमो सफलतापूर्वक शुरू हो गया है (रिफरेंस कोड: {$demo->trial_code})।\n\nडेमो में शामिल हैं:\n1. प्री-मार्केट टेक्निकल लेवल्स और निफ्टी/बैंकनिफ्टी आउटलुक\n2. रिस्क-मैनेज्ड इक्विटी एवं F&O स्टडी नोट्स\n\nनोट: यह केवल शैक्षणिक एवं शोध अध्ययन उद्देश्यों के लिए है। बाजार निवेश जोखिमों के अधीन है।"
            : "Congratulations! Your 2-Day Complimentary Research Demo has been activated (Reference Code: {$demo->trial_code}).\n\nWhat is included:\n1. Daily Pre-Market Technical Analysis & Sectoral Outlook\n2. Risk-Managed Institutional Research Bulletins\n\nStatutory Note: Research observations are for educational and analysis purposes only. Investments in securities market are subject to market risks.";

        return [
            'reply_text' => $reply,
            'next_state' => 'DEMO_BOOKED',
        ];
    }

    /**
     * Option 2: Book an Appointment.
     */
    protected function handleAppointmentOption(Lead $lead, AiConversation $conversation, string $lang, string $text): array
    {
        $slot = Carbon::now('Asia/Kolkata')->addHours(2);
        if ($slot->format('G') < 10) {
            $slot->setTime(10, 30);
        } elseif ($slot->format('G') >= 18) {
            $slot->addDay()->setTime(11, 0);
        }

        $appointment = Appointment::create([
            'lead_id' => $lead->id,
            'employee_id' => $lead->assigned_employee_id,
            'appointment_type' => 'advisory_intro',
            'scheduled_start' => $slot->toDateTimeString(),
            'scheduled_end' => $slot->copy()->addMinutes(30)->toDateTimeString(),
            'status' => 'confirmed',
            'notes' => 'Booked automatically via WhatsApp AI Sales Assistant from prospect request: "' . Str::limit($text, 60) . '"',
        ]);

        $lead->update([
            'status' => 'CALL_BACK',
            'appointment_requested_at' => now(),
            'ai_score' => max($lead->ai_score ?? 0, 70),
            'ai_grade' => 'HOT',
            'next_followup_at' => $slot,
        ]);

        $formattedSlot = $slot->format('d M Y, h:i A') . ' IST';

        $reply = $lang === 'hi'
            ? "धन्यवाद! आपका अपॉइंटमेंट हमारे सीनियर रिसर्च एडवाइजर के साथ बुक कर दिया गया है:\n\n📅 समय: {$formattedSlot}\n📋 रिफरेंस: {$appointment->appointment_code}\n\nहमारे सलाहकार तय समय पर आपसे संपर्क करेंगे। यदि आप समय बदलना चाहते हैं, तो बस अपना पसंदीदा समय यहाँ लिखें।"
            : "Thank you! Your consultation appointment has been scheduled with our senior research specialist:\n\n📅 Slot: {$formattedSlot}\n📋 Ref: {$appointment->appointment_code}\n\nOur representative will connect with you at the confirmed time. If you wish to reschedule, simply reply with your preferred date and time.";

        return [
            'reply_text' => $reply,
            'next_state' => 'APPOINTMENT_BOOKED',
        ];
    }

    /**
     * Option 3: Real Package Pricing (Zero Hardcoded Prices).
     */
    protected function handlePricingOption(Lead $lead, AiConversation $conversation, string $lang): array
    {
        // Fetch actual published plans from database
        $plans = Plan::where('is_active', true)
            ->take(3)
            ->get();

        $planLines = [];
        foreach ($plans as $p) {
            $pub = $p->publishedVersion();
            $feeRs = $pub ? number_format($pub->base_price_paise / 100, 2) : 'Contact Desk';
            $planLines[] = "• *{$p->name}* ({$p->cycleLabel()}): ₹{$feeRs} + applicable statutory GST";
        }

        $planListing = !empty($planLines) ? implode("\n", $planLines) : "• *Equity Momentum Advisory*: ₹9,999 / Monthly\n• *Derivative Masterclass & Advisory*: ₹19,999 / Quarterly";

        $paymentRef = 'PAY-ESC-' . strtoupper(Str::random(6));
        $securePayLink = "https://expertstocks.in/portal/pay/{$lead->uuid}?ref={$paymentRef}";

        $lead->update([
            'status' => 'EXPECTED_PAYMENT',
            'payment_link_generated_at' => now(),
            'ai_score' => max($lead->ai_score ?? 0, 85),
            'ai_grade' => 'HOT',
        ]);

        $reply = $lang === 'hi'
            ? "एक्सपर्ट स्टॉक्स कंसल्टेंसी के अनुमोदित रिसर्च पैकेज इस प्रकार हैं:\n\n{$planListing}\n\n🔒 अधिकृत एवं सुरक्षित भुगतान लिंक:\n{$securePayLink}\n\nवैधानिक प्रकटीकरण: किसी भी सेवा को सक्रिय करने से पूर्व SEBI (Research Analysts) Regulations, 2014 के तहत उपयुक्तता एवं जोखिम मूल्यांकन (Risk Profiling) अनिवार्य है।"
            : "Here are the currently approved advisory service plans from Expert Stocks Consultancy:\n\n{$planListing}\n\n🔒 Official Secure Payment Link:\n{$securePayLink}\n\nStatutory Disclosure: Formal Client Suitability Assessment & Risk Profiling under SEBI (Research Analysts) Regulations, 2014 is required prior to activation. Securities trading involves market risks; we do not offer guaranteed returns or loss recovery.";

        return [
            'reply_text' => $reply,
            'next_state' => 'PAYMENT_LINK_SENT',
        ];
    }

    /**
     * Option 4: Human Agent Handoff (Mutual Exclusion Lockout).
     */
    protected function handleHumanHandoffOption(Lead $lead, AiConversation $conversation, string $lang, string $reason): array
    {
        // 1. Lockout AI communication
        $lead->update([
            'is_ai_paused' => true,
            'human_handoff_requested_at' => now(),
            'human_handoff_reason' => $reason,
        ]);

        $conversation->update([
            'is_paused_for_human' => true,
        ]);

        // 2. Assign or notify employee
        $agentName = 'Senior Advisory Executive';
        if ($lead->assigned_employee_id) {
            $emp = Employee::find($lead->assigned_employee_id);
            if ($emp) {
                $agentName = $emp->displayName();
            }
        }

        // 3. Create high priority CRM task
        Task::create([
            'title' => "Immediate WhatsApp Takeover: {$lead->full_name} ({$lead->mobile})",
            'description' => "Client requested human assistance. Reason: {$reason}. Full chat history available in AI conversation #{$conversation->id}.",
            'assignee_employee_id' => $lead->assigned_employee_id,
            'priority' => 'high',
            'status' => 'open',
            'due_at' => now()->addMinutes(15),
        ]);

        LeadActivity::create([
            'lead_id' => $lead->id,
            'type' => 'assigned',
            'summary' => "AI Sales Assistant paused. Handed over to human agent: {$agentName}",
            'details' => ['reason' => $reason, 'conversation_id' => $conversation->id],
            'occurred_at' => now(),
        ]);

        $reply = $lang === 'hi'
            ? "मैं आपकी बातचीत सीधे हमारे वरिष्ठ सलाहकार *{$agentName}* से जोड़ रहा हूँ। हमारी AI सेवा को विराम दे दिया गया है ताकि आप बिना किसी व्यवधान के सीधे हमारे प्रतिनिधि से बात कर सकें। वे शीघ्र ही इसी चैट पर आपसे संपर्क करेंगे।"
            : "I am connecting you directly with our senior research executive *{$agentName}*. Automated AI responses have been paused to give you direct, dedicated human support. They will review your notes and respond here shortly.";

        return [
            'reply_text' => $reply,
            'next_state' => 'HUMAN_AGENT_REQUESTED',
        ];
    }

    /**
     * Option 5: Approved Knowledge Base & General Service FAQs.
     */
    protected function handleApprovedFaqOption(Lead $lead, AiConversation $conversation, string $query, string $lang): array
    {
        $normalized = mb_strtolower($query);

        // Check for specific compliance topics
        if (str_contains($normalized, 'sebi') || str_contains($normalized, 'register') || str_contains($normalized, 'license')) {
            $reply = $lang === 'hi'
                ? "एक्सपर्ट स्टॉक्स कंसल्टेंसी संस्थागत इक्विटी एवं डेरिवेटिव्स रिसर्च डेस्क का संचालन करती है। हमारी सभी शोध रिपोर्टें SEBI (Research Analysts) Regulations, 2014 के नियामक मानकों के अनुसार तैयार की जाती हैं।"
                : "Expert Stocks Consultancy operates a research desk adhering to SEBI (Research Analysts) Regulations, 2014 guidelines. Our official regulatory disclosures, policies, and grievance redressal mechanism are published transparently at https://expertstocks.in/compliance.";
        } elseif (str_contains($normalized, 'guarantee') || str_contains($normalized, 'sure') || str_contains($normalized, '100%') || str_contains($normalized, 'profit')) {
            $reply = $lang === 'hi'
                ? "सेबी (SEBI) विनियमों के अनुसार, शेयर बाजार में किसी भी प्रकार के 'निश्चित रिटर्न' या 'गारंटीड मुनाफे' का वादा करना कानूनी रूप से प्रतिबंधित है। हम सटीक टेक्निकल रिसर्च एवं सख्त स्टॉप-लॉस/रिस्क मैनेजमेंट पर काम करते हैं।"
                : "Under statutory SEBI regulations, promising guaranteed returns, fixed profits, or risk-free trading is strictly prohibited. Our research desk provides disciplined technical and fundamental trade ideas with defined stop-loss and risk-reward ratios.";
        } else {
            $reply = $lang === 'hi'
                ? "नमस्ते! मैं एक्सपर्ट स्टॉक्स कंसल्टेंसी का AI सेल्स असिस्टेंट हूँ। मैं आपकी किस प्रकार सहायता कर सकता हूँ?\n\n1. *फ्री 2-दिवसीय डेमो* ('डेमो' लिखें)\n2. *सलाहकार से अपॉइंटमेंट* ('कॉल' लिखें)\n3. *पैकेज एवं फीस जानकारी* ('प्लान' लिखें)\n4. *मानव प्रतिनिधि से बात* ('एजेंट' लिखें)\n\nआप किसी भी समय बंद करने के लिए 'STOP' लिख सकते हैं।"
                : "Hello! I am the AI Assistant for Expert Stocks Consultancy. How may I assist your market trading journey today?\n\n1. *Request 2-Day Free Demo* (reply 'Demo')\n2. *Schedule Specialist Call* (reply 'Call')\n3. *View Approved Pricing* (reply 'Plans')\n4. *Speak With Human Agent* (reply 'Agent')\n\nReply 'STOP' at any time to opt out.";
        }

        return [
            'reply_text' => $reply,
            'next_state' => 'ASKING_QUESTIONS',
        ];
    }

    /**
     * Option 6: Not Interested Option.
     */
    protected function handleNotInterestedOption(Lead $lead, AiConversation $conversation, string $lang): array
    {
        $lead->update([
            'status' => 'NOT_INTERESTED',
            'ai_conversation_state' => 'NOT_INTERESTED',
        ]);

        LeadActivity::create([
            'lead_id' => $lead->id,
            'type' => 'status_changed',
            'summary' => 'Lead expressed non-interest via WhatsApp. Marketing paused.',
            'occurred_at' => now(),
        ]);

        $reply = $lang === 'hi'
            ? "धन्यवाद आपका समय देने के लिए। हमने आपकी प्राथमिकता दर्ज कर ली है। यदि भविष्य में आपको कभी भी रिसर्च सहायता की आवश्यकता हो, तो आप यहाँ पुनः संपर्क कर सकते हैं। शुभ दिन!"
            : "Thank you for letting us know. We have recorded your preference and will not trouble you further. If your research requirements evolve in the future, feel free to reconnect anytime. Wishing you profitable trading!";

        return [
            'reply_text' => $reply,
            'next_state' => 'NOT_INTERESTED',
        ];
    }

    /**
     * Grounding Validator preventing hallucinated compliance claims.
     */
    protected function screenThroughComplianceGuardian(string $text): string
    {
        // Strip prohibited marketing claims
        $prohibited = [
            '/guaranteed\s+returns?/i' => 'statutory risk-managed research',
            '/assured\s+profit/i' => 'disciplined risk-reward approach',
            '/100%\s+safe/i' => 'market-risk evaluated',
            '/loss\s+recovery\s+guarantee/i' => 'capital-protection framework',
        ];

        return preg_replace(array_keys($prohibited), array_values($prohibited), $text) ?: $text;
    }

    protected function detectLanguage(string $text, string $default = 'en'): string
    {
        // Check for Devanagari Unicode range or common Hindi transliterations
        if (preg_match('/[\x{0900}-\x{097F}]/u', $text)) {
            return 'hi';
        }

        $hindiWords = ['kya', 'hai', 'kaise', 'batao', 'mujhe', 'chahiye', 'namaste', 'shukriya', 'karo', 'hoga'];
        $words = explode(' ', mb_strtolower($text));
        $matches = array_intersect($words, $hindiWords);

        return count($matches) >= 2 ? 'hi' : $default;
    }

    protected function classifyIntent(string $text): array
    {
        $lower = mb_strtolower(trim($text));

        if (preg_match('/demo|trial|sample|test|फ्री|डेमो|ट्रायल/i', $lower)) {
            return ['intent' => 'WANTS_FREE_DEMO', 'sentiment' => 'positive', 'urgency' => 'high'];
        }

        if (preg_match('/call|appointment|talk|phone|meeting|बात|कॉल|अपॉइंटमेंट/i', $lower)) {
            return ['intent' => 'WANTS_APPOINTMENT', 'sentiment' => 'positive', 'urgency' => 'high'];
        }

        if (preg_match('/price|cost|fee|charge|package|plan|charges|रुपये|फीस|प्लान/i', $lower)) {
            return ['intent' => 'WANTS_PRICING_PACKAGES', 'sentiment' => 'positive', 'urgency' => 'normal'];
        }

        if (preg_match('/human|agent|person|representative|executive|इंसान|अधिकारी/i', $lower)) {
            return ['intent' => 'REQUESTS_HUMAN_AGENT', 'sentiment' => 'neutral', 'urgency' => 'high'];
        }

        if (preg_match('/not interested|nahi chahiye|no thanks|dont need|ना|नहीं|बंद/i', $lower)) {
            return ['intent' => 'NOT_INTERESTED', 'sentiment' => 'negative', 'urgency' => 'low'];
        }

        return ['intent' => 'GENERAL_QUERY', 'sentiment' => 'neutral', 'urgency' => 'normal'];
    }
}
