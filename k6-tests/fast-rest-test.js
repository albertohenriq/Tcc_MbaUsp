import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  vus: 50,
  duration: '1m',
  thresholds: {
    'errors': ['rate<0.1'],
    'http_req_duration': ['p(95)<1000'],
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  const payload = JSON.stringify({
    field1: 'test data for processing',
    field2: 'rest test',
    field3: Date.now() % 1000000,
    field4: true,
    field5: ['item1', 'item2'],
    field6: { key1: 'value1', key2: 'value2' },
    field7: Math.random().toString(36).substr(2, 9),
    field8: Math.random() * 100,
    field9: 'additional_data',
    field10: 'test_field'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  let response = http.post(`${BASE_URL}/api/process`, payload, params);
  
  let success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has success': (r) => JSON.parse(r.body).success === true,
  });

  errorRate.add(!success);
  // Remover sleep para melhor performance
}
