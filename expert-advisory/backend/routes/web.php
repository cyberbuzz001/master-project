<?php

use App\Http\Controllers\DocumentDownloadController;
use App\Http\Controllers\SsoHandoffController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/sso', [SsoHandoffController::class, 'consume'])
    ->name('sso.consume');

Route::get('/documents/{document}/download', DocumentDownloadController::class)
    ->middleware(['auth', 'signed', 'throttle:30,1'])
    ->name('documents.download');
