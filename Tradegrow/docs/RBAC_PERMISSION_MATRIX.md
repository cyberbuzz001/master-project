# Role-Based Access Control (RBAC) Permission Matrix

## Roles & Hierarchy

1. **SUPER_ADMIN**: Full system administration, global system configuration, role management.
2. **ADMIN**: Platform administration, user management, virtual capital adjustments, system settings.
3. **RISK_MANAGER**: RMS parameter configuration, leverage limits, circuit limit management.
4. **OPERATIONS_MANAGER**: Operational monitoring, user status management, audit log review.
5. **DEALER**: Read-only observation of trading activities and risk parameters.
6. **SUPPORT_AGENT**: Support operations, password resets, user activity logs view.
7. **ANALYST**: Read-only market analytics and reporting access.
8. **USER / CLIENT**: Personal trading account, virtual wallet, order placement (simulated), portfolio, watchlists, alerts.
9. **READ_ONLY_AUDITOR**: System audit log and compliance reporting read-only access.

---

## Detailed Permission Matrix

| Permission / Resource | SUPER_ADMIN | ADMIN | RISK_MANAGER | OPERATIONS_MANAGER | DEALER | SUPPORT_AGENT | ANALYST | USER / CLIENT | READ_ONLY_AUDITOR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Auth: Register / Self-Login** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Auth: Manage Roles & Permissions** | Yes | No | No | No | No | No | No | No | No |
| **User: Manage All Users** | Yes | Yes | No | Yes | No | View Only | No | No | No |
| **User: Reset Password / Force Logout** | Yes | Yes | No | Yes | No | Yes | No | No | No |
| **User: View Own Profile & Data** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Virtual Wallet: Initial Capital Allocation** | Yes | Yes | No | No | No | No | No | System | No |
| **Virtual Wallet: Manual Adjustments** | Yes | Yes | No | No | No | No | No | No | No |
| **Virtual Wallet: View Own Ledger** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Trading: Submit Virtual Order** | No* | No* | No* | No* | No* | No* | No* | Yes | No |
| **Trading: Cancel / View Own Orders** | Yes | Yes | View All | View All | View All | View All | View All | Own Only | View All |
| **Trading: View Own Positions & PnL** | Own | Own | Own | Own | Own | Own | Own | Own Only | Own |
| **RMS: Modify System Risk Rules** | Yes | Yes | Yes | No | No | No | No | No | No |
| **Market Data: Access Live Feeds** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Market Data: Provider Config** | Yes | Yes | No | No | No | No | No | No | No |
| **Admin Panel: Access Dashboard** | Yes | Yes | Yes | Yes | Yes | View Limited | View Limited | No | View Limited |
| **Audit Logs: Read Compliance Logs** | Yes | Yes | Yes | Yes | Yes | No | No | No | Yes |
| **System Health & Telemetry** | Yes | Yes | Yes | Yes | No | No | No | No | No |

*\*Note: Administrative roles retain platform governance rights; virtual trading operations are restricted to designated user/client paper accounts to preserve administrative audit hygiene.*

---

## Technical Enforcement Rules

1. **Server-Side Enforcement**: All API routes check authorization tokens against the permission matrix via custom authentication and RBAC middleware (`authorize(permission)`).
2. **Resource-Level Authorization**: Every database query accessing user assets (`orders`, `positions`, `holdings`, `virtual_wallets`) must explicitly bind the query with `WHERE user_id = :authenticated_user_id` unless the request holds administrative bypass authority (`View All` permission).
3. **Immutable Virtual Ledger**: Ledger records created via administrative funds adjustments require mandatory audit trail logging (`admin_actions` table).
