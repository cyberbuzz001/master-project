import concurrent.futures
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import main
from fastapi import HTTPException
from levels import generate
from models import Snapshot


def fixture():
    now = datetime.now(timezone.utc)
    return Snapshot.model_validate({
        'symbol': 'RELIANCE', 'token': '2885', 'source': 'dhan', 'asset_type': 'stock',
        'as_of': now, 'last_price': '1339.70', 'tick_size': '.05', 'lot_size': 1,
        'risk_budget': '1000', 'bars': [
            {'timestamp': now-timedelta(minutes=31-i), 'open': 1300+i,
             'high': 1302+i, 'low': 1298+i, 'close': 1301+i, 'volume': 1000}
            for i in range(30)]})


class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        main.DB = str(Path(self.folder.name)/'jobs.sqlite')
        main.initialize()

    def tearDown(self):
        self.folder.cleanup()

    def test_tick_alignment_and_risk_budget(self):
        snapshot = fixture()
        result = generate(snapshot)
        entry, stop, target = [Decimal(result[key]) for key in ('entry_above','stop_loss','target')]
        self.assertTrue(stop < entry < target)
        self.assertTrue(all(x % snapshot.tick_size == 0 for x in (entry, stop, target)))
        self.assertLessEqual((entry-stop)*result['max_quantity_at_stop'], snapshot.risk_budget)

    def test_reject_stale_and_future_and_expired(self):
        snapshot = fixture()
        for seconds in (-61, 1):
            with self.assertRaises(ValueError):
                generate(snapshot.model_copy(update={'as_of': snapshot.as_of+timedelta(seconds=seconds)}))
        with self.assertRaises(ValueError):
            generate(snapshot.model_copy(update={'asset_type':'option', 'expires_at': snapshot.as_of-timedelta(seconds=1)}))

    def test_option_premium_and_lots(self):
        s = fixture()
        s = s.model_copy(update={'asset_type':'option', 'underlying':'NIFTY', 'lot_size':75,
                                'expires_at':s.as_of+timedelta(hours=1)})
        result = generate(s)
        self.assertEqual(result['basis'], 'option premium')
        self.assertEqual(result['max_quantity_at_stop'] % 75, 0)

    def test_concurrent_idempotency_and_payload_conflict(self):
        s = fixture()
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
            results = list(pool.map(lambda _: main.submit(s, 'same-request'), range(10)))
        self.assertEqual(len({r['id'] for r in results}), 1)
        with self.assertRaises(HTTPException) as error:
            main.submit(s.model_copy(update={'risk_budget': Decimal(500)}), 'same-request')
        self.assertEqual(error.exception.status_code, 409)

    def test_worker_persists_result(self):
        job = main.submit(fixture(), 'worker-request')
        main.process_one()
        result = main.get_job(job['id'])
        self.assertEqual(result['status'], 'COMPLETED')
        self.assertFalse(result['result']['execution_enabled'])

    def test_auth_rejects_missing_secret(self):
        import os
        from unittest.mock import patch
        with patch.dict(os.environ, {'RESEARCH_API_KEY':'a'*32}):
            with self.assertRaises(HTTPException):
                main.authorize('Bearer wrong')

    def test_api_auth_and_submission(self):
        import os
        from unittest.mock import patch
        from fastapi.testclient import TestClient
        with patch.dict(os.environ, {'RESEARCH_API_KEY':'a'*32}):
            with TestClient(main.app) as client:
                self.assertEqual(client.get('/health').status_code, 401)
                headers = {'Authorization':'Bearer '+'a'*32, 'Idempotency-Key':'api-request'}
                response = client.post('/jobs', json=fixture().model_dump(mode='json'), headers=headers)
                self.assertEqual(response.status_code, 202)
                result = client.get('/jobs/'+response.json()['id'], headers=headers)
                self.assertEqual(result.status_code, 200)


if __name__ == '__main__':
    unittest.main()
