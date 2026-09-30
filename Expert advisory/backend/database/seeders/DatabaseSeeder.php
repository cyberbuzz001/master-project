<?php

namespace Database\Seeders;

use App\Domain\Identity\RbacSynchronizer;
use Illuminate\Database\Seeder;

/**
 * Reference data required in every environment. Contains no clients, payments,
 * testimonials, performance figures or regulatory registrations.
 */
class DatabaseSeeder extends Seeder
{
    public function run(RbacSynchronizer $rbac): void
    {
        $rbac->sync();

        $this->call([
            LeadSourceSeeder::class,
            SystemSettingsSeeder::class,
            PolicyDocumentSeeder::class,
            OnboardingSeeder::class,
            BootstrapSuperAdminSeeder::class,
        ]);

        if (config('platform.demo_mode') && ! app()->isProduction()) {
            $this->call(DemoSeeder::class);
        }
    }
}
