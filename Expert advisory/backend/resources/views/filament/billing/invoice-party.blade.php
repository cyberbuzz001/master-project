@php
    $invoice = $getRecord();
    $client = $invoice->client_snapshot ?? [];
    $entity = $invoice->legal_entity_snapshot ?? [];
@endphp

<div class="esc-kv">
    <div><span>Name</span><strong>{{ $client['name'] ?? '—' }}</strong></div>
    <div><span>Client code</span><strong>{{ $client['client_code'] ?? '—' }}</strong></div>
    @if (! empty($client['email']))<div><span>Email</span><strong>{{ $client['email'] }}</strong></div>@endif
    @if (! empty($client['mobile']))<div><span>Mobile</span><strong>{{ $client['mobile'] }}</strong></div>@endif
    @if (! empty($invoice->place_of_supply))<div><span>Place of supply</span><strong>{{ $invoice->place_of_supply }}</strong></div>@endif
</div>

<p class="esc-meta">
    Details are the snapshot taken when the invoice was issued, so the record stays accurate if the client's details change later.
</p>

@if (! empty($entity['legal_entity_name']))
    <p class="esc-meta">Issued by {{ $entity['legal_entity_name'] }}@if (! empty($entity['registration_number'])) · {{ $entity['registration_number'] }}@endif</p>
@elseif ($invoice->status !== \App\Models\Invoice::DRAFT)
    <p class="esc-callout">No verified regulatory profile was active when this invoice was issued, so no registration details were printed.</p>
@endif
