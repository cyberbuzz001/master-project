// Relocated from routes/adminApi.ts unchanged, so it can be imported by
// middleware/auth.ts's checkPermission without a circular import (adminApi.ts
// already imports authenticateToken/checkRole from auth.ts).
//
// Phase A4a note: defaultRoles on KILL_SWITCH_TRIGGER, KYC_VERIFY_APPROVE,
// USER_CREATE, USER_LOCK_UNLOCK, USER_RESET_PASSWORD and MARKET_DATA_CONFIG
// were adjusted from their original (decorative, never-enforced) values to
// exactly match the adminApi.ts route(s) they now guard, so that wiring them
// up does not silently change any existing staff member's access. This was
// safe only because none of these six keys were checked by any route before
// this change — POSITIONS_FORCE_CLOSE, RISK_LIMITS_EDIT, RMS_VIEW and
// RMS_SQUAREOFF_RUN were already enforced elsewhere and are untouched here.
export const SYSTEM_PERMISSION_CATEGORIES = [
  {
    category: 'Financial Operations',
    description: 'Wallet credits, withdrawals, direct balance adjustments & reserve management',
    permissions: [
      { key: 'DEPOSITS_APPROVE', label: 'Approve Deposits', description: 'Review and approve client UPI, Bank, and Gateway deposit receipts', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER'] },
      { key: 'WITHDRAWALS_APPROVE', label: 'Approve Withdrawals', description: 'Authorize client withdrawal payout and bank settlement transfers', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER'] },
      { key: 'DIRECT_BALANCE_ADJUST', label: 'Direct Balance Adjustment', description: 'Manually credit or debit user trading capital with audited ledger entry', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
      { key: 'PAYMENT_GATEWAYS_MANAGE', label: 'Manage Payment Gateways', description: 'Configure merchant UPI keys, QR codes, and bank accounts', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
      { key: 'PAYMENT_GATEWAYS_UPDATE', label: 'Update Payment Gateway Settings', description: 'Write merchant UPI/bank payment receiving settings', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { key: 'RESERVES_RECONCILE', label: 'Reserve & Solvency Audit', description: 'Audit broker physical bank cash reserves vs user aggregate liabilities', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
      { key: 'CUSTOMER_FUNDS_ADJUST_ADMIN', label: 'Adjust Customer Funds (Admin)', description: 'Add or deduct funds directly on a customer wallet from the Customer 360 view', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'KYC_OFFICER', 'COMPLIANCE_OFFICER', 'RISK_MANAGER', 'RISK_OFFICER', 'DEALER', 'ANALYST', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'] },
      { key: 'FUNDS_MANAGE', label: 'Manage & Synchronize Customer Margins', description: 'Recompute used margin, release stranded margins, and synchronize wallet balances', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER', 'DEALER', 'SUPPORT_AGENT'] },
      { key: 'FUNDS_OVERVIEW_VIEW', label: 'View Funds Overview & Requests', description: 'View the funds dashboard summary and the deposit/withdrawal request queue', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER'] },
      { key: 'LEDGER_VIEW', label: 'View Wallet Ledger', description: 'View the paginated wallet ledger with customer and transaction-type filters', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'READ_ONLY_AUDITOR'] },
    ]
  },
  {
    category: 'Trading & Risk Oversight',
    description: 'Order execution, kill-switches, margin limits, and emergency square-offs',
    permissions: [
      { key: 'SIM_ORDER_CANCEL', label: 'Force-Cancel Orders', description: 'Cancel pending and executing simulated equity & derivative orders', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'MANAGER'] },
      { key: 'POSITIONS_FORCE_CLOSE', label: 'Force-Liquidate Positions', description: 'Emergency market square-off open positions for margin calls', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'RISK_LIMITS_EDIT', label: 'Configure Risk Parameters', description: 'Modify margin multipliers, intraday leverage, and MTM loss limits', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'KILL_SWITCH_TRIGGER', label: 'Platform Kill Switch', description: 'Halt all order placements and market execution platform-wide', defaultRoles: ['SUPER_ADMIN'] },
      { key: 'RMS_VIEW', label: 'View RMS Settings & Risk Tiers', description: 'View current RMS mode, auto square-off configuration, and loss-tier thresholds', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'READ_ONLY_AUDITOR'] },
      { key: 'RMS_SQUAREOFF_RUN', label: 'Manually Trigger RMS Square-Off Run', description: 'Manually invoke the MIS auto square-off engine outside its scheduled run', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'RISK_DASHBOARD_VIEW', label: 'View Risk Command Center', description: 'View the risk dashboard, unresolved risk alerts, and kill-switch state', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'ORDERS_MONITOR_VIEW', label: 'View Order Monitor', description: 'View live and historical orders across all clients, and per-order lifecycle events', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'KYC_OFFICER', 'COMPLIANCE_OFFICER', 'RISK_MANAGER', 'RISK_OFFICER', 'DEALER', 'ANALYST', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'] },
      { key: 'ORDERS_MANAGE_ADMIN', label: 'Manage Orders (Admin)', description: 'Modify price, cancel, force-execute, reject, or place orders on behalf of a client', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'KYC_OFFICER', 'COMPLIANCE_OFFICER', 'RISK_MANAGER', 'RISK_OFFICER', 'DEALER', 'ANALYST', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'] },
      { key: 'POSITIONS_EDIT_ADMIN', label: 'Edit Positions (Admin)', description: 'Directly overwrite a position quantity or average price', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'KYC_OFFICER', 'COMPLIANCE_OFFICER', 'RISK_MANAGER', 'RISK_OFFICER', 'DEALER', 'ANALYST', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'] },
      { key: 'EXECUTIONS_PROVENANCE_VIEW', label: 'View Execution Provenance', description: 'View fill provenance and dispute audit detail for executions', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'KYC_OFFICER', 'READ_ONLY_AUDITOR'] },
    ]
  },
  {
    category: 'Operations & User Management',
    description: 'Account creation, customer status freezes, KYC approvals, and credentials',
    permissions: [
      { key: 'KYC_VERIFY_APPROVE', label: 'Approve KYC Applications', description: 'Verify Aadhaar, PAN, and bank details for trading accounts', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER', 'OPERATIONS_MANAGER'] },
      { key: 'KYC_REJECT', label: 'Reject / Request KYC Re-upload', description: 'Reject incomplete documents and trigger customer re-upload requests', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER'] },
      { key: 'USER_CREATE', label: 'Create New Customer', description: 'Manually provision new client profile and initial simulated capital', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER'] },
      { key: 'USER_LOCK_UNLOCK', label: 'Freeze / Unfreeze Accounts', description: 'Temporarily freeze customer accounts to prevent logins and trading', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'OPERATIONS_MANAGER', 'MANAGER'] },
      { key: 'USER_RESET_PASSWORD', label: 'Issue Password Resets', description: 'Generate one-time reset credentials for user account recovery', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER'] },
      { key: 'KYC_QUEUE_VIEW', label: 'View KYC Queue', description: 'View the pending / under-review KYC record queue', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'KYC_OFFICER', 'OPERATIONS_MANAGER'] },
      { key: 'CUSTOMERS_DUPLICATE_SCAN', label: 'Scan Duplicate Customers', description: 'Scan for duplicate emails, phone numbers, and PANs across all users', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER', 'OPERATIONS_MANAGER', 'MANAGER'] },
      { key: 'CUSTOMERS_PROFILE_EDIT', label: 'Edit Customer Profile', description: 'Edit a customer profile’s name, contact, and address fields', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      { key: 'CUSTOMERS_SUSPEND', label: 'Suspend Customer Accounts', description: 'Suspend a customer account with a reason and optional reinstatement date', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'CUSTOMERS_ACTIVATE', label: 'Reactivate Customer Accounts', description: 'Reactivate a suspended or locked customer account', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      { key: 'CUSTOMERS_LOCK', label: 'Security-Lock Customer Accounts', description: 'Apply a security hold lock to a customer account', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'CUSTOMERS_UNLOCK', label: 'Unlock Customer Accounts', description: 'Remove a security-hold lock from a customer account', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { key: 'CUSTOMERS_CLOSE', label: 'Permanently Close Customer Accounts', description: 'Permanently soft-close a customer account after dependency checks', defaultRoles: ['SUPER_ADMIN'] },
      { key: 'CUSTOMERS_DELETE', label: 'Delete Customer Account', description: 'Permanently delete customer account and purge associated records', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { key: 'SUPPORT_TICKETS_VIEW', label: 'View Support Tickets', description: 'View customer support tickets platform-wide', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'] },
      { key: 'SUPPORT_TICKETS_RESPOND', label: 'Respond to Support Tickets', description: 'Update ticket status and write admin response notes', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT'] },
      { key: 'SUPPORT_CHAT_VIEW', label: 'View Live Chat', description: 'View customer live-chat conversations platform-wide', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'] },
      { key: 'SUPPORT_CHAT_RESPOND', label: 'Respond in Live Chat', description: 'Send chat replies to customers in real time', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT'] },
    ]
  },
  {
    category: 'Audit, Feeds & System Security',
    description: 'Compliance audit trail, PII visibility, exchange feed credentials, and staff RBAC',
    permissions: [
      { key: 'VIEW_AUDIT_LOGS', label: 'View Immutable Audit Trail', description: 'Inspect timestamped actor logs for all admin and financial actions', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'READ_ONLY_AUDITOR'] },
      { key: 'VIEW_PII', label: 'View Unmasked PII', description: 'Access unmasked client phone numbers, emails, and KYC documentation', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER'] },
      { key: 'MARKET_DATA_CONFIG', label: 'Market Data & Feeds Config', description: 'Configure Angel One / Dhan / Fyers API keys and market data download storage', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'KYC_OFFICER', 'COMPLIANCE_OFFICER', 'RISK_MANAGER', 'RISK_OFFICER', 'DEALER', 'ANALYST', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'] },
      { key: 'MANAGE_ROLES_PERMISSIONS', label: 'Manage Roles & Permissions', description: 'Assign staff roles and configure user granular permission overrides', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { key: 'ADMIN_BROAD_VIEW', label: 'View Admin Reporting Surfaces', description: 'View broad read-only admin dashboards, customer records, and system/feed health', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER', 'KYC_OFFICER', 'COMPLIANCE_OFFICER', 'RISK_MANAGER', 'RISK_OFFICER', 'DEALER', 'ANALYST', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'] },
    ]
  },
  {
    category: 'Platform Administration',
    description: 'Manager-tier staff administration and brokerage connectivity credentials',
    permissions: [
      { key: 'MANAGERS_VIEW', label: 'View Managers', description: 'List manager-tier staff with capacity and approval limits', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { key: 'MANAGERS_ASSIGN', label: 'Assign Managers', description: 'Assign a user to a manager’s book', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { key: 'BROKER_TOKEN_MANAGE', label: 'Manage Broker Tokens', description: 'Hot-swap live Dhan/Fyers access tokens and complete Fyers OAuth', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { key: 'BROKER_TOKEN_STATUS_VIEW', label: 'View Broker Token Status', description: 'View Dhan/Fyers token expiry and health status', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    ]
  }
];

export interface PermissionCatalogEntry {
  key: string;
  label: string;
  description: string;
  defaultRoles: string[];
}

const permissionByKey = new Map<string, PermissionCatalogEntry>();
for (const cat of SYSTEM_PERMISSION_CATEGORIES) {
  for (const perm of cat.permissions) {
    permissionByKey.set(perm.key, perm);
  }
}

export function getPermissionCatalogEntry(key: string): PermissionCatalogEntry | undefined {
  return permissionByKey.get(key);
}
