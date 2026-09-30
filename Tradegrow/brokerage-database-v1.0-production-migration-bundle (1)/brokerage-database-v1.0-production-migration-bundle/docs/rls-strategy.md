# RLS Strategy

Client-facing access is enforced through PostgreSQL RLS where practical.
The API sets `SET LOCAL app.user_id = '<uuid>'` inside a transaction.

Ownership chain:
User -> Customer -> Trading Account -> Resource.

Service and administrative roles are granted explicit privileges and are not
used for ordinary end-customer requests. RLS policies must be tested against
cross-customer access attempts before production deployment.
