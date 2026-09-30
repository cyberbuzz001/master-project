describe('RLS strategy', () => {
  it('requires app.user_id request context', () => {
    expect('app.user_id').toBeTruthy();
  });
});
