<?php

return [
    'trading_holidays' => array_values(array_filter(explode(',', (string) env('CRM_TRADING_HOLIDAYS', '')))),
    'sessions' => [
        'equity' => ['open' => '09:15', 'close' => '15:30', 'review' => '15:45'],
        'index_options' => ['open' => '09:15', 'close' => '15:30', 'review' => '15:45'],
        'combo' => ['open' => '09:15', 'close' => '23:55', 'review' => '23:59'],
        'commodity' => ['open' => '09:00', 'close' => '23:55', 'review' => '23:59'],
    ],
];
