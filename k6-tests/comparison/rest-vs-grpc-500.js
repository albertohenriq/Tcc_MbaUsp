// Teste comparativo REST vs gRPC - 500 usuários
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { Trend } from 'k6/metrics';

// Métricas personalizadas
const restLatency = new Trend('rest_latency');
const grpcLatency = new Trend('grpc_latency');
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 500 },   // Rampa até 500 usuários em 1 minuto
    { duration: '5m', target: 500 },   // Mantém 500 usuários por 5 minutos
    { duration: '1m', target: 0 },     // Redução gradual em 1 minuto
  ],
  thresholds: {
    'rest_latency': ['p(95)<1000'],   // 95% das requisições REST < 1000ms
    'grpc_latency': ['p(95)<1000'],   // 95% das requisições gRPC < 1000ms
    'errors': ['rate<0.1'],           // Taxa de erro < 10%
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
  const startREST = new Date();
  const resREST = http.post('http://localhost:3000/api/process', 
    JSON.stringify(payload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  const endREST = new Date();
  
  restLatency.add(endREST - startREST);
  
  check(resREST, {
    'REST status is 200': (r) => r.status === 200,
    'REST response is valid': (r) => r.json('success') === true,
  }) || errorRate.add(1);

  sleep(1);

  // Teste gRPC (via proxy HTTP)
  const startGRPC = new Date();
  const resGRPC = http.post('http://localhost:3000/grpc/process',
    JSON.stringify(payload),
    {
      headers: { 
        'Content-Type': 'application/json',
        'X-Protocol': 'grpc'
      },
    }
  );
  const endGRPC = new Date();
  
  grpcLatency.add(endGRPC - startGRPC);
  
  check(resGRPC, {
    'gRPC status is 200': (r) => r.status === 200,
    'gRPC response is valid': (r) => r.json('success') === true,
  }) || errorRate.add(1);

  sleep(1);
}
