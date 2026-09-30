<?php

/**
 * Billing is configurable because tax treatment, numbering and payment rules differ by firm and can
 * change. Nothing here asserts a legal position: the rates are defaults a finance person must
 * confirm against the firm's own registration before invoices are issued.
 */
return [

    'currency' => env('BILLING_CURRENCY', 'INR'),
    'currency_symbol' => env('BILLING_CURRENCY_SYMBOL', '₹'),

    // Financial year start (month, day). India defaults to 1 April.
    'financial_year_start' => ['month' => (int) env('BILLING_FY_START_MONTH', 4), 'day' => 1],

    'numbering' => [
        'invoice' => ['prefix' => env('BILLING_INVOICE_PREFIX', 'INV'), 'pad' => 5],
        'receipt' => ['prefix' => env('BILLING_RECEIPT_PREFIX', 'RCP'), 'pad' => 5],
    ],

    'invoice' => [
        'due_days' => (int) env('BILLING_DUE_DAYS', 7),
        'terms' => env('BILLING_TERMS', 'Fees are payable in advance. Services start once payment is confirmed.'),
    ],

    /**
     * Tax codes available on plan versions and invoice lines. Set the rates that actually apply to
     * the firm; `exempt` keeps a zero line without implying anything about eligibility.
     */
    'tax_codes' => [
        'gst_18' => ['label' => 'GST 18%', 'rate' => 18.0, 'components' => ['cgst' => 9.0, 'sgst' => 9.0, 'igst' => 18.0]],
        'gst_5' => ['label' => 'GST 5%', 'rate' => 5.0, 'components' => ['cgst' => 2.5, 'sgst' => 2.5, 'igst' => 5.0]],
        'exempt' => ['label' => 'No tax', 'rate' => 0.0, 'components' => []],
    ],
    'default_tax_code' => env('BILLING_DEFAULT_TAX_CODE', 'gst_18'),
    // The state the firm supplies from; used to decide CGST+SGST versus IGST on the invoice.
    'home_state' => env('BILLING_HOME_STATE'),

    'payments' => [
        // Methods staff may record by hand. Gateway payments arrive through webhooks instead.
        'manual_methods' => ['upi', 'neft', 'imps', 'cash', 'cheque'],
        'labels' => [
            'upi' => 'UPI', 'neft' => 'NEFT', 'imps' => 'IMPS', 'card' => 'Card', 'netbanking' => 'Net banking',
            'cash' => 'Cash', 'cheque' => 'Cheque', 'gateway' => 'Payment gateway',
        ],
        // A manually recorded payment must be verified by someone other than the person who recorded it.
        'require_separate_verifier' => (bool) env('BILLING_SEPARATE_VERIFIER', true),
        'require_proof_for_manual' => (bool) env('BILLING_REQUIRE_PROOF', true),
        // Gateways are configured in Phase 4b; nothing is enabled by default.
        'providers' => [
            'cashfree' => ['enabled' => (bool) env('CASHFREE_ENABLED', false)],
            'razorpay' => ['enabled' => (bool) env('RAZORPAY_ENABLED', false)],
        ],
    ],

    'subscriptions' => [
        // Services never start on an unverified payment.
        'activate_on_verified_payment_only' => true,
        'renewal_reminder_days' => [30, 15, 7, 1],
    ],

];
