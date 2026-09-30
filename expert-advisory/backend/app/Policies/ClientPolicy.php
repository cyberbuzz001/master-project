<?php

namespace App\Policies;

use App\Models\Client;
use App\Models\User;

/**
 * Client records follow the same own → team → all scoping as leads. They are never deleted from the
 * UI; a relationship is closed with a reason instead.
 */
class ClientPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAny(['clients.view_own', 'clients.view_team', 'clients.view_all']);
    }

    public function view(User $user, Client $client): bool
    {
        return $this->viewAny($user) && Client::query()->visibleTo($user)->whereKey($client->getKey())->exists();
    }

    public function create(User $user): bool
    {
        return $user->can('clients.onboard');
    }

    public function update(User $user, Client $client): bool
    {
        return $user->can('clients.update') && $this->view($user, $client);
    }

    public function onboard(User $user, Client $client): bool
    {
        return $user->can('clients.onboard') && $this->view($user, $client);
    }

    public function assess(User $user, Client $client): bool
    {
        return $user->can('risk_profile.assess') && $this->view($user, $client);
    }

    public function viewRisk(User $user, Client $client): bool
    {
        return $user->canAny(['risk_profile.view', 'risk_profile.assess']) && $this->view($user, $client);
    }

    public function viewKyc(User $user, Client $client): bool
    {
        return $user->canAny(['kyc.view', 'kyc.verify', 'documents.upload']) && $this->view($user, $client);
    }

    public function uploadDocuments(User $user, Client $client): bool
    {
        return $user->can('documents.upload') && $this->view($user, $client);
    }

    public function delete(User $user, Client $client): bool
    {
        return false;
    }
}
