<?php

namespace Tests\Feature;

use App\Domain\Crm\UniversalLeadImporter;
use App\Models\Lead;
use App\Models\SuppressionRecord;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class UniversalImportSecurityTest extends TestCase
{
    private const PATH = '/api/v1/admin/leads/universal-import';

    public function test_anonymous_import_returns_401(): void
    {
        $this->postJson(self::PATH.'/preview', ['raw_text' => '9876543210'])->assertUnauthorized();
        $this->assertDatabaseCount('lead_import_previews', 0);
    }

    public function test_staff_without_import_permission_gets_403(): void
    {
        $this->actingAsVerified($this->makeStaff('business_advisor'))->postJson(self::PATH.'/preview', ['raw_text' => '9876543210'])->assertForbidden();
        $this->assertDatabaseCount('lead_import_previews', 0);
    }

    public function test_commit_rechecks_suppression_and_replay_returns_same_batch(): void
    {
        $this->freezeTime();
        $this->actingAsVerified($this->makeStaff('sales_manager'));
        $preview = $this->postJson(self::PATH.'/preview', ['raw_text' => 'Nina | 9876543210'])->assertOk()->json('data.preview_id');
        SuppressionRecord::create(['phone_e164' => '+919876543210', 'channel' => 'whatsapp', 'reason' => 'USER_OPT_OUT', 'suppressed_at' => now()]);
        $body = ['preview_id' => $preview, 'options' => ['consent_basis' => 'Website inquiry with explicit contact permission']];

        $first = $this->postJson(self::PATH.'/execute', $body)->assertCreated()->assertJsonPath('batch.accepted_count', 0)->json('batch.id');
        $this->postJson(self::PATH.'/execute', $body)->assertCreated()->assertJsonPath('batch.id', $first);

        $this->assertDatabaseCount('lead_import_batches', 1);
        $this->assertDatabaseCount('leads', 0);
        $this->assertDatabaseCount('scheduled_actions', 0);
    }

    public function test_cannot_commit_another_users_preview(): void
    {
        $owner = $this->makeStaff('sales_manager');
        $importer = app(UniversalLeadImporter::class);
        $preview = $importer->createPreview($importer->parseRawText('9876543210'), $owner);
        $this->actingAsVerified($this->makeStaff('sales_manager'));

        $this->postJson(self::PATH.'/execute', ['preview_id' => $preview->id, 'options' => ['consent_basis' => 'Website contact request']])->assertForbidden();

        $this->assertDatabaseCount('leads', 0);
        $this->assertDatabaseCount('lead_import_batches', 0);
    }

    public function test_client_supplied_preview_rows_are_rejected_with_422(): void
    {
        $this->actingAsVerified($this->makeStaff('sales_manager'));

        $this->postJson(self::PATH.'/execute', ['preview_result' => ['summary' => [], 'rows' => [['validation_status' => 'valid_new', 'mobile_e164' => '+919876543210']]], 'options' => ['consent_basis' => 'Website contact request']])->assertUnprocessable()->assertJsonValidationErrors(['preview_id', 'preview_result']);

        $this->assertDatabaseCount('leads', 0);
    }

    public function test_import_rechecks_duplicate_flags_before_writing(): void
    {
        $manager = $this->makeStaff('sales_manager');
        $existing = Lead::create(['full_name' => 'Keep existing customer', 'mobile' => '+919876543210', 'status' => 'NEW']);
        $other = Lead::create(['full_name' => 'Unnamed Lead', 'mobile' => '+919988776655', 'status' => 'NEW']);
        $importer = app(UniversalLeadImporter::class);
        $tampered = ['rows' => [['full_name' => 'Wrong overwrite', 'raw_mobile' => '9876543210', 'mobile_e164' => '+919988776655', 'is_valid' => true, 'validation_status' => 'duplicate_in_crm', 'existing_lead_id' => $other->id]]];

        $batch = $importer->executeImport($tampered, ['consent_basis' => 'Website contact request', 'duplicate_strategy' => 'update_empty_fields'], $manager);

        $this->assertSame(0, $batch->accepted_count);
        $this->assertSame('Keep existing customer', $existing->fresh()->full_name);
        $this->assertSame('Unnamed Lead', $other->fresh()->full_name);
        $this->assertDatabaseCount('leads', 2);
    }

    public function test_phone_only_csv_header_in_column_zero_is_not_imported_as_data(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'crm-csv');
        file_put_contents($file, "mobile\n9876543210\n");
        try {
            $rows = app(UniversalLeadImporter::class)->parseSpreadsheetFile($file, 'csv');
            $this->assertCount(1, $rows);
            $this->assertSame('+919876543210', $rows[0]['mobile_e164']);
        } finally {
            unlink($file);
        }
    }

    public function test_unsupported_xls_is_rejected(): void
    {
        $this->expectException(ValidationException::class);
        app(UniversalLeadImporter::class)->parseSpreadsheetFile('/unused.xls', 'xls');
    }

    public function test_uncertain_ocr_requires_correction_and_is_not_eligible(): void
    {
        $manager = $this->makeStaff('sales_manager');
        $preview = app(UniversalLeadImporter::class)->createPreview([['full_name' => 'Nina', 'raw_mobile' => '9876543210', 'uncertain_ocr' => true]], $manager);

        $this->assertSame(0, $preview->payload['summary']['eligible_import_count']);
        $this->assertSame('uncertain_ocr', $preview->payload['rows'][0]['validation_status']);
    }

    public function test_expired_preview_does_not_create_leads(): void
    {
        $this->freezeTime();
        $manager = $this->makeStaff('sales_manager');
        $importer = app(UniversalLeadImporter::class);
        $preview = $importer->createPreview($importer->parseRawText('9876543210'), $manager);
        $this->travel(31)->minutes();
        $this->actingAsVerified($manager);

        $this->postJson(self::PATH.'/execute', ['preview_id' => $preview->id, 'options' => ['consent_basis' => 'Website contact request']])->assertUnprocessable()->assertJsonPath('error_code', 'PREVIEW_EXPIRED');

        $this->assertDatabaseCount('leads', 0);
    }

    public function test_import_does_not_imply_whatsapp_or_call_consent(): void
    {
        $this->actingAsVerified($this->makeStaff('sales_manager'));
        $id = $this->postJson(self::PATH.'/preview', ['raw_text' => '9876543210'])->assertOk()->json('data.preview_id');

        $this->postJson(self::PATH.'/execute', ['preview_id' => $id, 'options' => ['consent_basis' => 'Customer requested account record creation']])->assertCreated()->assertJsonPath('batch.accepted_count', 1);

        $this->assertDatabaseHas('consent_records', ['purpose' => 'whatsapp', 'granted' => false]);
        $this->assertDatabaseHas('consent_records', ['purpose' => 'calls', 'granted' => false]);
        $this->assertDatabaseCount('scheduled_actions', 0);
    }
}
