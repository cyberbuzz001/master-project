<?php

namespace App\Http\Controllers;

use App\Domain\Onboarding\DocumentVault;
use App\Models\Client;
use App\Models\Document;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Documents are only ever served through a short-lived signed link, to the person the link was
 * issued to, and every download is written to the document's access log.
 */
class DocumentDownloadController extends Controller
{
    public function __construct(private readonly DocumentVault $vault) {}

    public function __invoke(Request $request, string $document): StreamedResponse
    {
        $record = Document::query()->where('uuid', $document)->firstOrFail();
        $user = $request->user();

        $allowed = $user->can('documents.download')
            || ($record->owner_type === 'client' && $this->ownsClient($request, $record->owner_id));

        abort_unless($allowed, 403, 'You are not allowed to download this document.');

        return $this->vault->download($user, $record);
    }

    private function ownsClient(Request $request, int $clientId): bool
    {
        return Client::query()->whereKey($clientId)->where('user_id', $request->user()->id)->exists();
    }
}
