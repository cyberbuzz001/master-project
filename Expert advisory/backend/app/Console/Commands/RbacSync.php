<?php

namespace App\Console\Commands;

use App\Domain\Identity\RbacSynchronizer;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('rbac:sync')]
#[Description('Synchronize roles and permissions from config/rbac.php')]
class RbacSync extends Command
{
    public function handle(RbacSynchronizer $rbac): int
    {
        $result = $rbac->sync();
        $this->info("Synchronized {$result['permissions']} permissions and {$result['roles']} roles.");

        return self::SUCCESS;
    }
}
