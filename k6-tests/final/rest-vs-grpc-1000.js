// Teste final comparativo REST vs gRPC - 1000 usuários
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas personalizadas
const restLatency = new Trend('rest_latency');
const grpcLatency = new Trend('grpc_latency');
const restP99Latency = new Trend('rest_p99_latency');
const grpcP99Latency = new Trend('grpc_p99_latency');
const errorRate = new Rate('error_rate');
const restThroughput = new Trend('rest_throughput');
const grpcThroughput = new Trend('grpc_throughput');

export const options = {
  stages: [
    { duration: '30s', target: 1000 }, // Ramp-up: 30s
    { duration: '5m', target: 1000 },  // Carga constante: 5min
    { duration: '30s', target: 0 },    // Ramp-down: 30s
  ],
  thresholds: {
    'rest_latency': ['p(95)<2000'],    // Latência p95
    'grpc_latency': ['p(95)<2000'],    // Latência p95
    'rest_p99_latency': ['p(99)<2500'], // Latência p99
    'grpc_p99_latency': ['p(99)<2500'], // Latência p99
    'error_rate': ['rate<0.1'],        // Taxa de erro < 10%
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
  const startREST = new Date();
  const resREST = http.post('http://localhost:3000/api/process', 
    JSON.stringify(payload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  const endREST = new Date();
  const restDuration = endREST - startREST;
  
  restLatency.add(restDuration);
  restP99Latency.add(restDuration);
  restThroughput.add(1);
  
  check(resREST, {
    'REST status is 200': (r) => r.status === 200,
    'REST response is valid': (r) => r.json('success') === true,
  }) || errorRate.add(1);

  sleep(1);

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
  const grpcDuration = endGRPC - startGRPC;
  
  grpcLatency.add(grpcDuration);
  grpcP99Latency.add(grpcDuration);
  grpcThroughput.add(1);
  
  check(resGRPC, {
    'gRPC status is 200': (r) => r.status === 200,
    'gRPC response is valid': (r) => r.json('success') === true,
  }) || errorRate.add(1);

  sleep(1);
}
