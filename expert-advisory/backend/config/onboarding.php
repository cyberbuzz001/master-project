<?php

/**
 * Client onboarding is configurable because the exact KYC set and document retention a firm must keep
 * depends on its registrations and its own policy. Nothing here asserts a legal requirement; the
 * regulatory profile (config/compliance + regulatory_profile_versions) is the source of truth for that.
 */
return [

    // Ordered steps created for every new client. Keys are referenced by the onboarding service.
    'steps' => [
        'profile' => ['label' => 'Client details captured', 'required' => true],
        'agreements' => ['label' => 'Service agreement accepted', 'required' => true],
        'kyc' => ['label' => 'Identity documents verified', 'required' => true],
        'risk_profile' => ['label' => 'Risk profile completed', 'required' => true],
        'suitability' => ['label' => 'Suitability reviewed and signed off', 'required' => true],
        'service_selection' => ['label' => 'Service selected', 'required' => false],
        'welcome' => ['label' => 'Welcome pack sent', 'required' => false],
    ],

    // Identity checks requested during onboarding. Numbers are stored masked plus a salted hash.
    'kyc' => [
        'required_types' => ['pan', 'address'],
        'types' => [
            'pan' => ['label' => 'PAN', 'pattern' => '/^[A-Z]{5}[0-9]{4}[A-Z]$/', 'mask' => 'last4'],
            'aadhaar' => ['label' => 'Aadhaar (last 4 digits only)', 'pattern' => '/^[0-9]{4}$/', 'mask' => 'none'],
            'passport' => ['label' => 'Passport', 'pattern' => null, 'mask' => 'last4'],
            'voter_id' => ['label' => 'Voter ID', 'pattern' => null, 'mask' => 'last4'],
            'driving_licence' => ['label' => 'Driving licence', 'pattern' => null, 'mask' => 'last4'],
            'bank_account' => ['label' => 'Bank account', 'pattern' => null, 'mask' => 'last4'],
            'address' => ['label' => 'Address proof', 'pattern' => null, 'mask' => 'none'],
        ],
    ],

    'documents' => [
        'disk' => env('DOCUMENT_DISK', 'local'),
        'max_size_kb' => (int) env('DOCUMENT_MAX_SIZE_KB', 10240),
        'allowed_mimes' => ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        // Contents are encrypted at rest with the application key unless the disk does it for us.
        'encrypt_at_rest' => (bool) env('DOCUMENT_ENCRYPT_AT_REST', true),
        'signed_url_ttl_minutes' => (int) env('DOCUMENT_URL_TTL_MINUTES', 5),
        'categories' => [
            'pan' => 'PAN card',
            'aadhaar' => 'Aadhaar (masked)',
            'address_proof' => 'Address proof',
            'bank_proof' => 'Bank proof',
            'photo' => 'Photograph',
            'signed_agreement' => 'Signed agreement',
            'risk_profile_report' => 'Risk profile report',
            'invoice' => 'Invoice',
            'receipt' => 'Payment receipt',
            'correspondence' => 'Correspondence',
            'other' => 'Other',
        ],
        'retention' => [
            'default_policy' => 'client_records',
            'policies' => [
                // Years to retain after the client relationship ends. Set from the firm's own policy.
                'client_records' => ['label' => 'Client records', 'years' => (int) env('RETENTION_CLIENT_YEARS', 5)],
                'correspondence' => ['label' => 'Correspondence', 'years' => (int) env('RETENTION_CORRESPONDENCE_YEARS', 5)],
            ],
        ],
    ],

    'risk_profile' => [
        // Re-profiling cadence; null means the questionnaire version decides.
        'valid_for_days' => (int) env('RISK_PROFILE_VALID_DAYS', 365),
        'require_client_acknowledgement' => true,
    ],

];
