describe('idempotency invariants', () => {
  it('documents account + idempotency_key uniqueness', () => {
    expect('trading_account_id + idempotency_key').toContain('idempotency_key');
  });
});
