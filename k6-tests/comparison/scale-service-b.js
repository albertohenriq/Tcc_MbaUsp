import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const latency = new Trend('latency_ms');
const errorRate = new Rate('error_rate');
const throughput = new Trend('throughput');

export let options = {
  vus: 100,
  duration: '3m',
  thresholds: {
    'latency_ms': ['p(95)<1000'],
    'error_rate': ['rate<0.1']
  }
};

const payload = {
  field1: "teste1",
  field2: "teste2",
  field3: 123
};

export default function () {
  const start = Date.now();
  const res = http.post('http://localhost:3000/api/process', JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' }
  });
  const dur = Date.now() - start;
  latency.add(dur);
  throughput.add(1);

  check(res, {
    'status 200': (r) => r.status === 200,
    'body success': (r) => r.json('success') === true
  }) || errorRate.add(1);

  sleep(0.5);
}
