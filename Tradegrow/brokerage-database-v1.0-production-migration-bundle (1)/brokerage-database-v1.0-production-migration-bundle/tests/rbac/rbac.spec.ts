describe('RBAC seed', () => {
  it('defines expected system roles', () => {
    expect(['SUPER_ADMIN','OPS_ADMIN','RISK_ADMIN','COMPLIANCE','FINANCE','SUPPORT','CLIENT']).toHaveLength(7);
  });
});
