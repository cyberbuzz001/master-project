INSERT INTO identity.roles(code,name,description) VALUES
('SUPER_ADMIN','Super Administrator','Full platform administration'),
('OPS_ADMIN','Operations Administrator','Operations and back office'),
('RISK_ADMIN','Risk Administrator','Risk and RMS controls'),
('COMPLIANCE','Compliance Officer','KYC and compliance operations'),
('FINANCE','Finance Officer','Ledger, payments and reconciliation'),
('SUPPORT','Customer Support','Customer support operations'),
('CLIENT','Client','End customer')
ON CONFLICT(code) DO NOTHING;

INSERT INTO identity.permissions(code,name,resource,action) VALUES
('customer.read','Read customers','customer','read'),
('customer.update','Update customers','customer','update'),
('kyc.review','Review KYC','kyc','review'),
('order.create','Create orders','order','create'),
('order.read','Read orders','order','read'),
('order.cancel','Cancel orders','order','cancel'),
('risk.manage','Manage risk limits','risk','manage'),
('ledger.read','Read ledger','ledger','read'),
('ledger.post','Post ledger transactions','ledger','post'),
('payment.read','Read payments','payment','read'),
('payment.approve','Approve withdrawals','payment','approve'),
('reconciliation.run','Run reconciliation','reconciliation','run'),
('reconciliation.resolve','Resolve reconciliation exceptions','reconciliation','resolve'),
('audit.read','Read audit trail','audit','read'),
('admin.rbac','Manage RBAC','rbac','manage')
ON CONFLICT(code) DO NOTHING;

INSERT INTO identity.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM identity.roles r CROSS JOIN identity.permissions p
WHERE r.code='SUPER_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO identity.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM identity.roles r JOIN identity.permissions p
ON p.code IN ('customer.read','customer.update','kyc.review','order.read','audit.read')
WHERE r.code='OPS_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO identity.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM identity.roles r JOIN identity.permissions p
ON p.code IN ('risk.manage','order.read','order.cancel')
WHERE r.code='RISK_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO identity.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM identity.roles r JOIN identity.permissions p
ON p.code IN ('kyc.review','customer.read','audit.read')
WHERE r.code='COMPLIANCE'
ON CONFLICT DO NOTHING;

INSERT INTO identity.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM identity.roles r JOIN identity.permissions p
ON p.code IN ('ledger.read','ledger.post','payment.read','payment.approve','reconciliation.run','reconciliation.resolve')
WHERE r.code='FINANCE'
ON CONFLICT DO NOTHING;

INSERT INTO identity.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM identity.roles r JOIN identity.permissions p
ON p.code IN ('customer.read','order.read')
WHERE r.code='SUPPORT'
ON CONFLICT DO NOTHING;

INSERT INTO identity.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM identity.roles r JOIN identity.permissions p
ON p.code IN ('order.create','order.read','order.cancel','ledger.read','payment.read')
WHERE r.code='CLIENT'
ON CONFLICT DO NOTHING;
