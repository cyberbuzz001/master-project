<?php

return [
    /*
     * Next.js origin serving the public site, client portal and the shared sign-in page.
     */
    'frontend_url' => rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/'),

    /*
     * Demo mode shows `is_demo` records. Must be false in production;
     * analytics exclude demo records regardless.
     */
    'demo_mode' => (bool) env('DEMO_MODE', false),

    'timezone_display' => env('PLATFORM_DISPLAY_TIMEZONE', 'Asia/Kolkata'),

    'security' => [
        'max_failed_logins' => (int) env('SECURITY_MAX_FAILED_LOGINS', 5),
        'lockout_base_minutes' => (int) env('SECURITY_LOCKOUT_BASE_MINUTES', 15),
        'lockout_max_minutes' => (int) env('SECURITY_LOCKOUT_MAX_MINUTES', 1440),
        'enforce_staff_2fa' => (bool) env('SECURITY_ENFORCE_STAFF_2FA', true),
        'recovery_code_count' => 8,
        'password_min_length' => 12,
    ],

    'bootstrap' => [
        'super_admin_email' => env('INITIAL_SUPER_ADMIN_EMAIL'),
        'super_admin_name' => env('INITIAL_SUPER_ADMIN_NAME', 'Super Admin'),
        'super_admin_password' => env('INITIAL_SUPER_ADMIN_PASSWORD'),
    ],

    'leads' => [
        'duplicate_window_days' => (int) env('LEAD_DUPLICATE_WINDOW_DAYS', 90),
    ],
];
