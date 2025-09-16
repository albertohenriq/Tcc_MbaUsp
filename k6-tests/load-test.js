import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp-up para 100 usuários
    { duration: '5m', target: 100 },   // Manter 100 usuários por 5 minutos
    { duration: '30s', target: 0 },    // Ramp-down para 0
  ],
  thresholds: {
    'errors': ['rate<0.1'],  // Taxa de erro menor que 10%
    'http_req_duration': ['p(95)<500'],  // 95% das requisições abaixo de 500ms
  },
};

const payload = {
  field1: "teste1",
  field2: "teste2",
  field3: 123,
  field4: true,
  field5: ["item1", "item2"],
  field6: { nested: "value" },
  field7: new Date().toISOString(),
  field8: 456.78,
  field9: "teste9",
  field10: "teste10"
};

export default function () {
  // Teste REST
  const resREST = http.post('http://service-b:3001/api/data', JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(resREST, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);
}

// Testes gRPC serão implementados em um arquivo separado usando ghz ou outro cliente gRPC compatível
