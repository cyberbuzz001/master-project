describe('RMS & Ledger Position Flip vs Square-Off Logic', () => {
  function computeExposure(currentNetQty: number, orderSide: 'BUY' | 'SELL', orderQuantity: number) {
    const isOppositeSide = (currentNetQty > 0 && orderSide === 'SELL') || (currentNetQty < 0 && orderSide === 'BUY');
    const absCurrentNetQty = Math.abs(currentNetQty);
    const isPureSquareOff = isOppositeSide && orderQuantity <= absCurrentNetQty;
    const isPositionFlip = isOppositeSide && orderQuantity > absCurrentNetQty;
    const isSquareOff = isPureSquareOff;

    const openingQty = isPositionFlip
      ? orderQuantity - absCurrentNetQty
      : (isOppositeSide ? 0 : orderQuantity);

    return {
      isOppositeSide,
      isPureSquareOff,
      isPositionFlip,
      isSquareOff,
      openingQty
    };
  }

  test('long +10, sell 5: pure square-off, 0 new exposure', () => {
    const res = computeExposure(10, 'SELL', 5);
    expect(res.isPureSquareOff).toBe(true);
    expect(res.isSquareOff).toBe(true);
    expect(res.isPositionFlip).toBe(false);
    expect(res.openingQty).toBe(0);
  });

  test('long +10, sell 10: exact closing, 0 new exposure', () => {
    const res = computeExposure(10, 'SELL', 10);
    expect(res.isPureSquareOff).toBe(true);
    expect(res.isSquareOff).toBe(true);
    expect(res.isPositionFlip).toBe(false);
    expect(res.openingQty).toBe(0);
  });

  test('long +10, sell 100: position flip, 90 units opening exposure requiring margin', () => {
    const res = computeExposure(10, 'SELL', 100);
    expect(res.isPureSquareOff).toBe(false);
    expect(res.isSquareOff).toBe(false);
    expect(res.isPositionFlip).toBe(true);
    expect(res.openingQty).toBe(90);
  });

  test('short -5, buy 5: exact closing, 0 new exposure', () => {
    const res = computeExposure(-5, 'BUY', 5);
    expect(res.isPureSquareOff).toBe(true);
    expect(res.isSquareOff).toBe(true);
    expect(res.isPositionFlip).toBe(false);
    expect(res.openingQty).toBe(0);
  });

  test('short -5, buy 20: position flip, 15 units opening exposure requiring margin', () => {
    const res = computeExposure(-5, 'BUY', 20);
    expect(res.isPureSquareOff).toBe(false);
    expect(res.isSquareOff).toBe(false);
    expect(res.isPositionFlip).toBe(true);
    expect(res.openingQty).toBe(15);
  });

  test('flat 0, buy 10: new exposure of 10 units', () => {
    const res = computeExposure(0, 'BUY', 10);
    expect(res.isPureSquareOff).toBe(false);
    expect(res.isSquareOff).toBe(false);
    expect(res.isPositionFlip).toBe(false);
    expect(res.openingQty).toBe(10);
  });

  test('flat 0, sell 10: new short exposure of 10 units', () => {
    const res = computeExposure(0, 'SELL', 10);
    expect(res.isPureSquareOff).toBe(false);
    expect(res.isSquareOff).toBe(false);
    expect(res.isPositionFlip).toBe(false);
    expect(res.openingQty).toBe(10);
  });
});
