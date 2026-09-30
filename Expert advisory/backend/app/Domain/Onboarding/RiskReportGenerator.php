<?php

namespace App\Domain\Onboarding;

use App\Domain\Audit\AuditLogger;
use App\Domain\Compliance\RegulatoryProfileService;
use App\Models\Document;
use App\Models\RiskProfile;
use App\Models\RiskReport;
use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Renders the client's risk profile as a PDF and files it in the document vault. The PDF carries a
 * verification token and the SHA-256 of its own bytes, so a copy can always be checked against the
 * record that produced it. Nothing in the report is generated text: every figure comes from the
 * stored assessment.
 */
final class RiskReportGenerator
{
    public function __construct(
        private readonly DocumentVault $vault,
        private readonly AuditLogger $audit,
        private readonly RegulatoryProfileService $profiles,
    ) {}

    public function generate(RiskProfile $profile, ?User $actor = null): RiskReport
    {
        $existing = RiskReport::query()->where('risk_profile_id', $profile->id)->first();

        if ($existing !== null) {
            return $existing;
        }

        $profile->loadMissing(['client', 'answers.question', 'questionnaireVersion']);

        $token = Str::lower(Str::random(40));
        $number = $this->nextNumber();
        $verificationUrl = rtrim((string) config('platform.frontend_url'), '/').'/verify/'.$token;

        $pdf = Pdf::loadView('pdf.risk-report', [
            'profile' => $profile,
            'client' => $profile->client,
            'version' => $profile->questionnaireVersion,
            'band' => $profile->questionnaireVersion->bandFor($profile->raw_score),
            'answers' => $profile->answers,
            'reportNumber' => $number,
            'verificationUrl' => $verificationUrl,
            'qr' => $this->qr($verificationUrl),
            'entity' => $this->profiles->active(),
            'generatedAt' => now(config('platform.timezone_display')),
        ])->setPaper('a4');

        $contents = $pdf->output();

        return DB::transaction(function () use ($profile, $contents, $number, $token, $actor): RiskReport {
            $document = $this->vault->storeGenerated(
                $actor,
                'client',
                $profile->client_id,
                'risk_profile_report',
                $number.'.pdf',
                $contents,
                'application/pdf',
                ['is_demo' => (bool) $profile->is_demo],
            );

            $report = RiskReport::create([
                'risk_profile_id' => $profile->id,
                'report_number' => $number,
                'pdf_sha256' => hash('sha256', $contents),
                'verification_token' => $token,
                'document_id' => $document->id,
            ]);

            $this->audit->record('risk_report.generated', $report, new: [
                'report_number' => $number,
                'risk_profile_id' => $profile->id,
                'pdf_sha256' => $report->pdf_sha256,
            ], actor: $actor);

            return $report;
        });
    }

    public function documentFor(RiskProfile $profile): ?Document
    {
        return RiskReport::query()->where('risk_profile_id', $profile->id)->first()?->document;
    }

    private function qr(string $url): string
    {
        $writer = new Writer(new ImageRenderer(new RendererStyle(150, 1), new SvgImageBackEnd));

        return 'data:image/svg+xml;base64,'.base64_encode($writer->writeString($url));
    }

    private function nextNumber(): string
    {
        $prefix = 'RP-'.now()->format('Y');
        $last = RiskReport::query()->where('report_number', 'like', $prefix.'-%')->orderByDesc('id')->value('report_number');
        $serial = $last === null ? 0 : (int) substr($last, strrpos($last, '-') + 1);

        return sprintf('%s-%05d', $prefix, $serial + 1);
    }
}
