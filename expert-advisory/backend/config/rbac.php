<?php

/*
|--------------------------------------------------------------------------
| RBAC catalogue
|--------------------------------------------------------------------------
| Single source of truth for roles and permissions. `php artisan rbac:sync`
| writes it to the database and `php artisan rbac:matrix` regenerates
| docs/RBAC_MATRIX.md. Record-level scope (own / team / all) is enforced
| separately by policies and query scopes.
*/

$permissions = [
    'platform' => [
        'dashboard.admin.view' => 'View admin command center',
        'dashboard.manager.view' => 'View manager dashboard',
        'dashboard.research.view' => 'View research desk',
        'dashboard.employee.view' => 'View employee workspace',
        'settings.view' => 'View system settings',
        'settings.manage' => 'Change system settings',
        'api_credentials.manage' => 'Manage API credentials',
        'system.health.view' => 'View system health',
    ],
    'identity' => [
        'users.view' => 'View users and login history',
        'users.create' => 'Create users',
        'users.update' => 'Update users',
        'users.deactivate' => 'Deactivate users',
        'roles.view' => 'View roles and permissions',
        'roles.assign' => 'Assign non-privileged roles',
        'roles.assign_privileged' => 'Assign privileged roles',
        'teams.view' => 'View teams',
        'teams.manage' => 'Manage teams',
        'employees.view' => 'View employees',
        'employees.manage' => 'Manage employees',
    ],
    'audit' => [
        'audit.view' => 'View audit log',
        'audit.export' => 'Export audit log',
    ],
    'compliance' => [
        'regulatory_profile.view' => 'View regulatory profile',
        'regulatory_profile.edit' => 'Draft regulatory profile versions',
        'regulatory_profile.verify' => 'Verify and activate regulatory profile',
        'policies.view_drafts' => 'View draft policies',
        'policies.edit' => 'Draft policy versions',
        'policies.approve' => 'Approve policy versions',
        'policies.publish' => 'Publish approved policy versions',
        'consent.view' => 'View consent records',
        'compliance.review' => 'Review flagged communications',
        'compliance.rules.manage' => 'Manage compliance rules',
        'research_persons.authorize' => 'Mark employees as authorized research persons',
        'complaints.view' => 'View complaints',
        'complaints.manage' => 'Handle complaints',
    ],
    'crm' => [
        'leads.view_own' => 'View own leads',
        'leads.view_team' => 'View team leads',
        'leads.view_all' => 'View all leads',
        'leads.create' => 'Create leads',
        'leads.update' => 'Update leads',
        'leads.assign' => 'Assign leads',
        'leads.import' => 'Import leads',
        'leads.export' => 'Export leads',
        'followups.manage' => 'Manage follow-ups',
        'tasks.manage' => 'Manage tasks',
        'campaigns.view' => 'View campaigns',
        'campaigns.manage' => 'Manage campaigns',
        'vendors.view' => 'View vendors',
        'vendors.manage' => 'Manage vendors',
        'call_recordings.upload' => 'Upload call recordings',
        'call_recordings.listen' => 'Listen to call recordings',
        'sales_scripts.manage' => 'Draft objection-handling scripts',
    ],
    'clients' => [
        'clients.view_own' => 'View own clients',
        'clients.view_team' => 'View team clients',
        'clients.view_all' => 'View all clients',
        'clients.update' => 'Update client records',
        'clients.onboard' => 'Convert leads and run onboarding',
        'documents.upload' => 'Upload client documents',
        'risk_profile.assess' => 'Record a risk assessment with a client',
        'agreements.record' => 'Record an offline agreement acceptance',
        'kyc.view' => 'View KYC documents',
        'kyc.verify' => 'Verify KYC documents',
        'documents.download' => 'Download client documents',
        'risk_profile.view' => 'View risk profiles',
        'risk_profile.override' => 'Override risk category with reason',
    ],
    'billing' => [
        'services.manage' => 'Manage services and plans',
        'invoices.view' => 'View invoices',
        'invoices.create' => 'Create invoices',
        'invoices.void' => 'Void invoices',
        'payments.view' => 'View payments',
        'payments.verify_manual' => 'Verify manual payments',
        'payments.refund' => 'Approve refunds',
        'allocations.submit' => 'Submit payment credit allocation',
        'allocations.approve' => 'Approve payment credit allocation',
        'subscriptions.view' => 'View subscriptions',
        'subscriptions.activate' => 'Activate subscriptions',
    ],
    'research' => [
        'research.view_internal' => 'View internal research drafts',
        'research.create' => 'Create research drafts',
        'research.edit_draft' => 'Edit research drafts',
        'research.submit' => 'Submit research for review',
        'research.compliance_review' => 'Compliance-review research',
        'research.approve' => 'Approve research (authorized persons only)',
        'research.publish' => 'Publish approved research',
        'research.cancel' => 'Cancel published research',
        'recommendations.create' => 'Create recommendations',
        'recommendations.approve' => 'Approve recommendations (authorized persons only)',
        'backtests.run' => 'Run backtests',
        'market_data.view' => 'View market data',
    ],
    'ai' => [
        'ai.assistant.use' => 'Use CRM assistant',
        'ai.research_assistant.use' => 'Use research assistant',
        'ai.admin_assistant.use' => 'Use admin/BI assistant',
        'ai.call_analysis.run' => 'Run call analysis',
        'ai.prompts.manage' => 'Draft prompt versions',
        'ai.prompts.approve' => 'Approve prompt versions',
        'ai.models.manage' => 'Manage AI providers and models',
        'ai.usage.view' => 'View AI usage and cost',
    ],
    'messaging' => [
        'templates.manage' => 'Draft message templates',
        'templates.approve' => 'Approve message templates',
        'messages.send_approved' => 'Send approved-template messages',
        'automation.manage' => 'Manage automation rules',
    ],
    'content' => [
        'cms.manage' => 'Edit website content',
        'cms.publish' => 'Publish website content',
        'testimonials.verify' => 'Verify testimonials',
    ],
    'workforce' => [
        'training.manage' => 'Manage training modules',
        'attendance.view_team' => 'View team attendance',
        'attendance.view_all' => 'View all attendance',
    ],
    'analytics' => [
        'analytics.view' => 'View analytics',
        'analytics.export' => 'Export analytics',
    ],
    'support' => [
        'tickets.view' => 'View support tickets',
        'tickets.manage' => 'Handle support tickets',
    ],
    'portal' => [
        'portal.access' => 'Access client portal',
    ],
];

$all = array_merge(...array_map('array_keys', array_values($permissions)));

$salesBase = [
    'leads.create', 'leads.update', 'followups.manage', 'tasks.manage',
    'call_recordings.upload', 'invoices.view', 'payments.view', 'subscriptions.view',
    'ai.assistant.use', 'ai.call_analysis.run', 'messages.send_approved',
];

$researchContributor = [
    'dashboard.research.view', 'research.view_internal', 'research.create', 'research.edit_draft',
    'research.submit', 'recommendations.create', 'market_data.view', 'backtests.run',
    'ai.research_assistant.use',
];

return [
    'guard' => 'web',

    'permissions' => $permissions,

    /*
     * Roles only a user holding `roles.assign_privileged` may grant or revoke.
     */
    'privileged_roles' => ['super_admin', 'admin', 'compliance_admin', 'research_head', 'auditor'],

    /*
     * Permissions that additionally require employees.is_authorized_research_person.
     */
    'authorized_person_permissions' => ['research.approve', 'recommendations.approve'],

    'roles' => [
        'super_admin' => [
            'label' => 'Super Admin', 'staff' => true, 'requires_2fa' => true,
            'permissions' => array_values(array_diff($all, ['portal.access'])),
        ],
        'admin' => [
            'label' => 'Admin', 'staff' => true, 'requires_2fa' => true,
            'permissions' => array_values(array_diff($all, [
                'roles.assign_privileged', 'api_credentials.manage', 'regulatory_profile.verify',
                'policies.approve', 'research.compliance_review', 'research.approve',
                'recommendations.approve', 'research_persons.authorize', 'ai.prompts.approve',
                'templates.approve', 'compliance.rules.manage', 'portal.access',
            ])),
        ],
        'compliance_admin' => [
            'label' => 'Compliance Admin', 'staff' => true, 'requires_2fa' => true,
            'permissions' => [
                'dashboard.admin.view', 'system.health.view', 'users.view', 'roles.view', 'teams.view', 'employees.view',
                'audit.view', 'audit.export',
                'regulatory_profile.view', 'regulatory_profile.edit', 'regulatory_profile.verify',
                'policies.view_drafts', 'policies.edit', 'policies.approve', 'policies.publish',
                'consent.view', 'compliance.review', 'compliance.rules.manage', 'research_persons.authorize',
                'complaints.view', 'complaints.manage',
                'leads.view_all', 'clients.view_all', 'kyc.view', 'kyc.verify', 'documents.download', 'risk_profile.view', 'risk_profile.override', 'agreements.record',
                'call_recordings.listen', 'invoices.view', 'payments.view',
                'research.view_internal', 'research.compliance_review', 'research.cancel',
                'ai.prompts.approve', 'ai.usage.view', 'templates.approve', 'testimonials.verify', 'training.manage',
                'analytics.view',
            ],
        ],
        'research_head' => [
            'label' => 'Research Head', 'staff' => true, 'requires_2fa' => true,
            'permissions' => array_merge($researchContributor, [
                'research.approve', 'research.publish', 'research.cancel', 'recommendations.approve',
                'ai.prompts.manage', 'ai.usage.view', 'employees.view', 'teams.view',
                'regulatory_profile.view', 'risk_profile.view', 'analytics.view',
            ]),
        ],
        'senior_research_analyst' => [
            'label' => 'Senior Research Analyst', 'staff' => true, 'requires_2fa' => true,
            'permissions' => array_merge($researchContributor, ['research.approve', 'recommendations.approve', 'research.publish']),
        ],
        'research_analyst' => [
            'label' => 'Research Analyst', 'staff' => true, 'requires_2fa' => true,
            'permissions' => array_merge($researchContributor, ['research.approve', 'recommendations.approve']),
        ],
        'fundamental_analyst' => [
            'label' => 'Fundamental Analyst', 'staff' => true, 'requires_2fa' => true,
            'permissions' => $researchContributor,
        ],
        'technical_analyst' => [
            'label' => 'Technical Analyst', 'staff' => true, 'requires_2fa' => true,
            'permissions' => $researchContributor,
        ],
        'ai_research_assistant' => [
            'label' => 'AI Research Assistant', 'staff' => true, 'requires_2fa' => true,
            'permissions' => [
                'dashboard.research.view', 'research.view_internal', 'research.create', 'research.edit_draft',
                'market_data.view', 'ai.research_assistant.use',
            ],
        ],
        'sales_manager' => [
            'label' => 'Sales Manager', 'staff' => true, 'requires_2fa' => true,
            'permissions' => array_merge($salesBase, [
                'dashboard.manager.view', 'dashboard.employee.view', 'leads.view_all', 'leads.assign', 'leads.import', 'leads.export',
                'campaigns.view', 'vendors.view', 'call_recordings.listen', 'clients.view_all', 'sales_scripts.manage', 'attendance.view_all', 'training.manage',
                'clients.onboard', 'clients.update', 'documents.upload', 'documents.download', 'kyc.view', 'risk_profile.view', 'risk_profile.assess', 'agreements.record',
                'allocations.submit', 'analytics.view', 'teams.view', 'employees.view',
            ]),
        ],
        'team_leader' => [
            'label' => 'Team Leader', 'staff' => true, 'requires_2fa' => true,
            'permissions' => array_merge($salesBase, [
                'dashboard.manager.view', 'dashboard.employee.view', 'leads.view_team', 'leads.assign',
                'call_recordings.listen', 'clients.view_team', 'allocations.submit', 'teams.view', 'employees.view', 'attendance.view_team',
                'clients.onboard', 'clients.update', 'documents.upload', 'documents.download', 'kyc.view', 'risk_profile.view', 'risk_profile.assess',
            ]),
        ],
        'senior_business_advisor' => [
            'label' => 'Senior Business Advisor', 'staff' => true, 'requires_2fa' => true,
            'permissions' => array_merge($salesBase, [
                'dashboard.employee.view', 'leads.view_own', 'clients.view_own', 'allocations.submit', 'clients.onboard', 'clients.update',
                'documents.upload', 'risk_profile.view', 'risk_profile.assess',
            ]),
        ],
        'business_advisor' => [
            'label' => 'Business Advisor', 'staff' => true, 'requires_2fa' => true,
            'permissions' => array_merge($salesBase, [
                'dashboard.employee.view', 'leads.view_own', 'clients.view_own', 'clients.onboard', 'clients.update',
                'documents.upload', 'risk_profile.view', 'risk_profile.assess',
            ]),
        ],
        'payment_manager' => [
            'label' => 'Payment Manager', 'staff' => true, 'requires_2fa' => true,
            'permissions' => [
                'dashboard.employee.view', 'invoices.view', 'invoices.create', 'invoices.void',
                'payments.view', 'payments.verify_manual', 'allocations.approve',
                'subscriptions.view', 'subscriptions.activate', 'clients.view_all', 'kyc.view', 'kyc.verify',
                'documents.download', 'analytics.view',
            ],
        ],
        'customer_support' => [
            'label' => 'Customer Support', 'staff' => true, 'requires_2fa' => true,
            'permissions' => [
                'dashboard.employee.view', 'tickets.view', 'tickets.manage', 'complaints.view', 'complaints.manage',
                'clients.view_all', 'subscriptions.view', 'invoices.view', 'messages.send_approved',
            ],
        ],
        'content_manager' => [
            'label' => 'Content Manager', 'staff' => true, 'requires_2fa' => true,
            'permissions' => ['dashboard.employee.view', 'cms.manage', 'templates.manage', 'sales_scripts.manage', 'training.manage'],
        ],
        'marketing_manager' => [
            'label' => 'Marketing Manager', 'staff' => true, 'requires_2fa' => true,
            'permissions' => [
                'dashboard.manager.view', 'dashboard.employee.view', 'campaigns.view', 'campaigns.manage',
                'vendors.view', 'vendors.manage', 'leads.import', 'cms.manage', 'cms.publish',
                'templates.manage', 'automation.manage', 'analytics.view', 'analytics.export',
            ],
        ],
        'auditor' => [
            'label' => 'Auditor', 'staff' => true, 'requires_2fa' => true,
            'permissions' => [
                'dashboard.admin.view', 'system.health.view', 'users.view', 'roles.view', 'teams.view', 'employees.view',
                'audit.view', 'audit.export', 'regulatory_profile.view', 'policies.view_drafts', 'consent.view',
                'complaints.view', 'research.view_internal', 'invoices.view', 'payments.view',
                'subscriptions.view', 'ai.usage.view', 'analytics.view', 'attendance.view_all',
            ],
        ],
        'client' => [
            'label' => 'Client', 'staff' => false, 'requires_2fa' => false,
            'permissions' => ['portal.access'],
        ],
    ],
];
