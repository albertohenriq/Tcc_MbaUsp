// Teste final comparativo REST vs gRPC - 100 usuários
import http from 'k6/http';
import grpc from 'k6/net/grpc';
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
    { duration: '30s', target: 100 },  // Ramp-up: 30s
    { duration: '5m', target: 100 },   // Carga constante: 5min
    { duration: '30s', target: 0 },    // Ramp-down: 30s
  ],
  thresholds: {
    'rest_latency': ['p(95)<500'],     // Latência p95
    'grpc_latency': ['p(95)<500'],     // Latência p95
    'rest_p99_latency': ['p(99)<800'], // Latência p99
    'grpc_p99_latency': ['p(99)<800'], // Latência p99
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

// carregamos o proto no contexto init (permitido)
const protoClient = new grpc.Client();
protoClient.load(['./definitions'], 'process.proto');

export function setup() {
  return {};
}

export default function (data) {
  // Teste REST
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

  // Teste gRPC
  const startGRPC = new Date();
  try {
    console.log('Iniciando chamada gRPC...');
    console.log('Payload:', JSON.stringify(payload));
  // usa o cliente carregado no init (`protoClient`) para invocar
  // não chamamos load aqui (deve estar no init) e não fechamos o protoClient por VU
  protoClient.connect('127.0.0.1:50052', { plaintext: true });
  const resGRPC = protoClient.invoke('processing.ProcessingService/ProcessData', payload);
  console.log('Resposta gRPC:', JSON.stringify(resGRPC));
    const endGRPC = new Date();
    const grpcDuration = endGRPC - startGRPC;
    
    grpcLatency.add(grpcDuration);
    grpcP99Latency.add(grpcDuration);
    grpcThroughput.add(1);
    
    check(resGRPC, {
      'gRPC status is OK': (r) => r && r.status === grpc.StatusOK,
      'gRPC response is valid': (r) => r && r.message && r.message.success === true,
    }) || errorRate.add(1);
  } catch (error) {
    console.error('Erro na chamada gRPC. Detalhes:', error);
    console.error('Stack:', error.stack);
    errorRate.add(1);
  }

  sleep(1);
}

export function teardown(data) {
  try {
    // fecha o cliente carregado no init se existir
    if (typeof protoClient !== 'undefined' && protoClient) {
      try { protoClient.close(); } catch (e) { /* ignora */ }
    }
  } catch (error) {
    console.error('Erro ao fechar cliente gRPC:', error);
  }
}
