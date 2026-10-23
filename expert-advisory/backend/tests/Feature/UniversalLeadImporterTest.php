<?php

namespace Tests\Feature;

use App\Domain\Crm\UniversalLeadImporter;
use App\Models\Lead;
use App\Models\LeadImportBatch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UniversalLeadImporterTest extends TestCase
{
    use RefreshDatabase;

    private UniversalLeadImporter $importer;
    private User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->importer = new UniversalLeadImporter();
        $this->adminUser = User::factory()->create(['email' => 'admin@expertstocks.in']);
    }

    /**
     * Test Format 1 (Image 2): Single-column mobile numbers only.
     */
    public function test_parses_single_column_mobile_numbers_only(): void
    {
        $rawText = "9537131961\n8888808035\n7059432320\n9155986063\n9022220300";

        $rows = $this->importer->parseRawText($rawText);

        $this->assertCount(5, $rows);
        $this->assertEquals('+919537131961', $rows[0]['mobile_e164']);
        $this->assertEquals('Unnamed Lead', $rows[0]['full_name']);
        $this->assertTrue($rows[0]['phone_only']);
        $this->assertTrue($rows[0]['is_valid']);
        $this->assertEquals('+919022220300', $rows[4]['mobile_e164']);
    }

    /**
     * Test Format 2 (Image 1): Two columns Name and Mobile (tab or pipe separated).
     */
    public function test_parses_two_columns_name_and_mobile(): void
    {
        $rawText = "MISHAB THEKKA NHALIYIL\t8590800550\nSANJIT MANDAL\t8014479600\nSENTHILKUMAR THENMOZHI\t8610182030";

        $rows = $this->importer->parseRawText($rawText);

        $this->assertCount(3, $rows);
        $this->assertEquals('MISHAB THEKKA NHALIYIL', $rows[0]['full_name']);
        $this->assertEquals('+918590800550', $rows[0]['mobile_e164']);
        $this->assertFalse($rows[0]['phone_only']);
        $this->assertTrue($rows[0]['is_valid']);

        $this->assertEquals('SANJIT MANDAL', $rows[1]['full_name']);
        $this->assertEquals('+918014479600', $rows[1]['mobile_e164']);
    }

    /**
     * Test Format 4 (Image 3): Alternating Key-Value vertical rows with quotes.
     */
    public function test_parses_vertical_key_value_rows(): void
    {
        $rawText = <<<KV
"fullName"\t"ATTADA PRASAD",
"mobile"\t"9912829401",
"fullName"\t"ROHIT KUMAR SINGH",
"mobile"\t"7209390622",
"fullName"\t"SALIM BABULAL SAYYAD",
"mobile"\t"9226427240",
KV;

        $rows = $this->importer->parseRawText($rawText);

        $this->assertCount(3, $rows);
        $this->assertEquals('ATTADA PRASAD', $rows[0]['full_name']);
        $this->assertEquals('+919912829401', $rows[0]['mobile_e164']);

        $this->assertEquals('ROHIT KUMAR SINGH', $rows[1]['full_name']);
        $this->assertEquals('+917209390622', $rows[1]['mobile_e164']);

        $this->assertEquals('SALIM BABULAL SAYYAD', $rows[2]['full_name']);
        $this->assertEquals('+919226427240', $rows[2]['mobile_e164']);
    }

    /**
     * Test preview validation, deduplication in file and against existing CRM leads.
     */
    public function test_preview_and_validation_detects_duplicates_and_invalids(): void
    {
        // Pre-create an existing lead in CRM
        Lead::create([
            'full_name' => 'Existing Customer',
            'mobile' => '+919988776655',
            'status' => 'FOLLOW_UP',
            'country' => 'India',
        ]);

        $rawText = "Rahul Sharma\t9876543210\n" .            // Valid New
                   "Existing Customer\t9988776655\n" .        // Duplicate in CRM
                   "Rahul Duplicate\t9876543210\n" .         // Duplicate in File
                   "Invalid Person\t12345\n";                // Invalid phone

        $parsed = $this->importer->parseRawText($rawText);
        $preview = $this->importer->previewAndValidate($parsed);

        $summary = $preview['summary'];
        $this->assertEquals(4, $summary['total_rows']);
        $this->assertEquals(1, $summary['valid_count']);
        $this->assertEquals(1, $summary['duplicate_in_crm_count']);
        $this->assertEquals(1, $summary['duplicate_in_file_count']);
        $this->assertEquals(1, $summary['invalid_count']);

        // Check validation status on rows
        $rows = $preview['rows'];
        $this->assertEquals('valid_new', $rows[0]['validation_status']);
        $this->assertEquals('duplicate_in_crm', $rows[1]['validation_status']);
        $this->assertEquals('duplicate_in_file', $rows[2]['validation_status']);
        $this->assertEquals('invalid_phone', $rows[3]['validation_status']);
    }

    /**
     * Test execution of import with batch tracking and non-destructive duplicate handling.
     */
    public function test_executes_import_and_records_batch_attribution(): void
    {
        $rawText = "MISHAB THEKKA NHALIYIL\t8590800550\nSANJIT MANDAL\t8014479600";
        $parsed = $this->importer->parseRawText($rawText);
        $preview = $this->importer->previewAndValidate($parsed);

        $batch = $this->importer->executeImport($preview, [
            'original_filename' => 'Daily_Leads_Upload.txt',
            'consent_basis' => 'Webinar Opt-in Form 23 Oct 2026',
            'consent_whatsapp' => true,
            'consent_calls' => true,
        ], $this->adminUser);

        $this->assertInstanceOf(LeadImportBatch::class, $batch);
        $this->assertEquals(2, $batch->accepted_count);
        $this->assertTrue(str_starts_with($batch->batch_code, 'LIB-'));

        // Verify Leads in Database
        $this->assertDatabaseHas('leads', [
            'mobile' => '+918590800550',
            'full_name' => 'MISHAB THEKKA NHALIYIL',
            'communication_state' => 'CONSENT_VERIFIED',
            'lead_import_batch_id' => $batch->id,
        ]);

        $this->assertDatabaseHas('leads', [
            'mobile' => '+918014479600',
            'full_name' => 'SANJIT MANDAL',
            'communication_state' => 'CONSENT_VERIFIED',
            'lead_import_batch_id' => $batch->id,
        ]);
    }

    /**
     * Test downloadable CSV validation report generation.
     */
    public function test_generates_downloadable_validation_report_csv(): void
    {
        $rawText = "Valid Person\t9876543210\nBad Number\t111\n";
        $parsed = $this->importer->parseRawText($rawText);
        $preview = $this->importer->previewAndValidate($parsed);

        $csv = $this->importer->generateValidationReportCsv($preview['rows']);

        $this->assertStringContainsString('Row Number', $csv);
        $this->assertStringContainsString('Normalized E164', $csv);
        $this->assertStringContainsString('Valid Person', $csv);
        $this->assertStringContainsString('+919876543210', $csv);
        $this->assertStringContainsString('Invalid phone number format', $csv);
    }
}
