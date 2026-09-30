const { DhanAdapter } = require('./server/dist/marketData/DhanAdapter');
const { OptionChainEngine } = require('./server/dist/marketData/OptionChainEngine');

async function testSensex() {
  console.log('Testing SENSEX Option Chain...');
  const d = new DhanAdapter();
  const expiries = await d.getExpiryList('SENSEX');
  console.log('SENSEX expiries:', expiries);
  const rows = await d.getOptionChain('SENSEX', expiries[0]);
  console.log('SENSEX rows count from Dhan:', rows ? rows.length : 0);
  if (rows && rows.length > 0) {
    const atm = rows.find(r => r.strikePrice >= 77000 && r.strikePrice <= 78000) || rows[0];
    console.log('SENSEX sample strike:', atm.strikePrice, 'CE LTP:', atm.ce?.ltp, 'PE LTP:', atm.pe?.ltp);
  }

  const res = await OptionChainEngine.generateOptionChain({ symbol: 'SENSEX', strikeRange: '10' });
  console.log('Engine SENSEX -> spotPrice:', res.spotPrice, 'atmStrike:', res.atmStrike, 'chain count:', res.chain ? res.chain.length : 0);
  if (res.chain && res.chain.length > 0) {
    console.log('Engine Middle strike:', JSON.stringify(res.chain[Math.floor(res.chain.length/2)]));
  }
}

testSensex().catch(console.error);
