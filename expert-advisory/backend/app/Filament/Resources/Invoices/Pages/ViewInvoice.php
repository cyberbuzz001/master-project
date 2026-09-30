<?php

namespace App\Filament\Resources\Invoices\Pages;

use App\Filament\Resources\Invoices\InvoiceResource;
use App\Filament\Resources\Payments\Actions\PaymentActions;
use Filament\Resources\Pages\ViewRecord;

class ViewInvoice extends ViewRecord
{
    protected static string $resource = InvoiceResource::class;

    public function getHeading(): string
    {
        return $this->record->invoice_number;
    }

    public function getSubheading(): ?string
    {
        return $this->record->client?->full_name;
    }

    protected function getHeaderActions(): array
    {
        return [
            InvoiceResource::issue(),
            PaymentActions::recordForInvoice(),
            InvoiceResource::download(),
            InvoiceResource::void(),
        ];
    }
}
