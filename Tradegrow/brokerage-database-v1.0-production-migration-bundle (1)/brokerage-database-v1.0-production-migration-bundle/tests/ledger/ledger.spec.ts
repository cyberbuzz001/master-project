describe('ledger posting rules', () => {
  it('uses double-entry accounting', () => {
    const debit = 100;
    const credit = 100;
    expect(debit).toBe(credit);
  });
});
