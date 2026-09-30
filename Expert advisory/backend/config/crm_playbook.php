<?php

/*
|--------------------------------------------------------------------------
| Sales-floor status playbook
|--------------------------------------------------------------------------
| Adapted from the stockideacrm LeadStatusService (see docs/STOCKIDEACRM_REVIEW.md).
| Wording was adjusted so no step implies returns, accuracy, or research delivery outside
| the approval workflow. Edit here; changes are version-controlled.
*/

return [
    'statuses' => [
        'NEW' => [
            'definition' => 'A fresh enquiry that has not been contacted yet.',
            'required_actions' => [
                'Call within the first hour where call consent was given',
                'Confirm the person made the enquiry and note the markets they follow',
                'Check the consent panel before any WhatsApp or email',
            ],
            'next_step' => 'Log the call outcome; schedule a follow-up or call back as needed.',
            'checklist' => ['Is call consent recorded?', 'Is the first call logged?', 'Are segments and capital range noted?'],
        ],
        'NPC' => [
            'definition' => 'No pick-up: ringing, busy, switched off or unreachable.',
            'required_actions' => [
                'Retry at a different time of day',
                'Use WhatsApp only if WhatsApp consent is recorded',
                'Keep every attempt logged — attempts are counted automatically',
            ],
            'next_step' => 'After about 7 attempts across 3 days with no contact, move to Lost.',
            'checklist' => ['Is a retry scheduled?', 'Has an alternate time been tried?'],
            'attempt_threshold' => 7,
        ],
        'CALL_BACK' => [
            'definition' => 'The person asked to be called at a specific later time.',
            'required_actions' => ['Schedule the exact call-back time', 'Note the reason for the call back'],
            'next_step' => 'Call at the scheduled time and log the outcome.',
            'checklist' => ['Is the call-back time scheduled?', 'Is the reason documented?'],
        ],
        'FOLLOW_UP' => [
            'definition' => 'Interested, but not ready to decide yet (for example, discussing with family).',
            'required_actions' => [
                'Schedule a specific follow-up date and time',
                'Record their concerns, investment horizon and preferred segments',
                'Suggest the risk assessment before discussing any service',
            ],
            'next_step' => 'Re-engage at the scheduled time; offer a free trial only after the risk assessment.',
            'checklist' => ['Is the follow-up scheduled?', 'Are concerns documented?', 'Has the risk assessment been offered?'],
        ],
        'FREE_TRIAL' => [
            'definition' => 'Receiving a time-limited trial of the research service.',
            'required_actions' => [
                'Confirm the trial covers the segments matching their risk profile',
                'Check in after the research is delivered and explain the format and risk disclosures',
                'Record trial start and end dates',
            ],
            'next_step' => 'Before the trial ends, discuss plans; move to Expected payment only when they ask to subscribe.',
            'checklist' => ['Are trial dates recorded?', 'Is the segment correct for their profile?', 'Were risk disclosures shared?'],
        ],
        'EXPECTED_PAYMENT' => [
            'definition' => 'Has asked to subscribe and requested payment details.',
            'required_actions' => [
                'Share the official invoice or payment link only',
                'Help with payment issues; never collect payment to personal accounts',
                'Follow up every few hours until the payment is verified or declined',
            ],
            'next_step' => 'The lead becomes Paid automatically when the payment is verified — it cannot be set by hand.',
            'checklist' => ['Was the official payment link sent?', 'Is the plan and amount documented?', 'Is a follow-up scheduled?'],
        ],
        'PAID' => [
            'definition' => 'A payment has been verified by the payment workflow.',
            'required_actions' => ['Confirm KYC documents are complete', 'Confirm the risk profile is finalized', 'Confirm the client agreement is accepted'],
            'next_step' => 'Service activation happens once KYC, risk profile and agreement are complete.',
            'checklist' => ['Is KYC complete?', 'Is the risk profile finalized?', 'Is the agreement accepted?'],
        ],
        'CONVERTED' => [
            'definition' => 'An active client with an activated service.',
            'required_actions' => ['Collect service feedback', 'Handle support requests through tickets'],
            'next_step' => 'Client servicing and renewal reminders take over.',
            'checklist' => [],
        ],
        'NOT_INTERESTED' => [
            'definition' => 'Clearly declined the service.',
            'required_actions' => ['Document the reason', 'Do not call again unless they re-enquire'],
            'next_step' => 'Keep for reporting; re-engage only with fresh consent.',
            'checklist' => ['Is the reason documented?'],
        ],
        'DND' => [
            'definition' => 'Asked not to be contacted. Contact consents are withdrawn automatically.',
            'required_actions' => ['Do not call, message or email', 'Escalate to compliance if they later re-enquire'],
            'next_step' => 'Only compliance can lift this, after recording fresh consent.',
            'checklist' => [],
        ],
        'INVALID' => [
            'definition' => 'Wrong number, fake details or not a genuine enquiry.',
            'required_actions' => ['Note why the lead is invalid (used for vendor quality reports)'],
            'next_step' => 'No further action.',
            'checklist' => [],
        ],
        'LOST' => [
            'definition' => 'Unreachable after repeated attempts or no longer a prospect.',
            'required_actions' => ['Document the reason for closing'],
            'next_step' => 'May be re-engaged later only if consent is still valid.',
            'checklist' => ['Is the reason documented?'],
        ],
    ],

    'tips' => [
        ['title' => 'Speed matters', 'body' => 'Fresh enquiries are easiest to reach in the first hour. Work your NEW leads first.'],
        ['title' => 'Follow-ups win', 'body' => 'Many decisions happen after several conversations. Keep your follow-up queue clear.'],
        ['title' => '“I need to think”', 'body' => 'Ask what is unclear. Explain how the research process and risk management work — never promise returns.'],
        ['title' => 'Goals before products', 'body' => 'Understand their horizon and tolerance for loss first; the risk assessment guides what is suitable.'],
        ['title' => 'Log it now', 'body' => 'Log every call outcome immediately. Accurate history protects you and the client.'],
    ],
];
