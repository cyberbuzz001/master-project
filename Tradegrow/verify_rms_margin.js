const { RMS } = require('./server/dist/trading/RMS');
const { OMS } = require('./server/dist/trading/OMS');

async function testMarginRejection() {
  const userId = 'usr_d076ef3e-2754-4567-84b2-38a86533ce6c';
  console.log('=== Testing RMS Order Validation for Option Selling (Short) with 5k Balance ===');
  
  // Attempt to SELL 1000 SENSEX 77200 PE @ 15.50
  const rmsResult = await RMS.validateOrder({
    userId,
    instrumentToken: 'BFO_SENSEX_77200_PE',
    exchange: 'BSE',
    symbol: 'SENSEX 77200 PE',
    side: 'SELL',
    quantity: 1000,
    price: 15.50,
    orderType: 'MARKET',
    productType: 'MIS'
  });

  console.log('RMS Validation Result:', rmsResult);

  // Attempt to submit order via OMS
  const omsResult = await OMS.submitOrder({
    userId,
    instrumentToken: 'BFO_SENSEX_77200_PE',
    exchange: 'BSE',
    symbol: 'SENSEX 77200 PE',
    side: 'SELL',
    quantity: 1000,
    price: 15.50,
    orderType: 'MARKET',
    productType: 'MIS'
  });

  console.log('OMS Submission Result:', omsResult);
}

testMarginRejection().then(() => process.exit(0)).catch(console.error);
