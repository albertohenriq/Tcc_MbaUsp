// Teste final comparativo REST vs gRPC - 500 usuários
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
    { duration: '30s', target: 500 },  // Ramp-up: 30s
    { duration: '5m', target: 500 },   // Carga constante: 5min
    { duration: '30s', target: 0 },    // Ramp-down: 30s
  ],
  thresholds: {
    'rest_latency': ['p(95)<1000'],    // Latência p95
    'grpc_latency': ['p(95)<1000'],    // Latência p95
    'rest_p99_latency': ['p(99)<1500'], // Latência p99
    'grpc_p99_latency': ['p(99)<1500'], // Latência p99
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

// Criamos um pool menor de clientes gRPC e carregamos o proto no init
// Conexões serão feitas sob demanda (lazy) no primeiro uso com stagger/retry
const POOL_SIZE = 20; // reduzido para evitar bursts
const poolClients = [];
const poolConnected = new Array(POOL_SIZE).fill(false);
const poolConnecting = new Array(POOL_SIZE).fill(false);
for (let i = 0; i < POOL_SIZE; i++) {
  const c = new grpc.Client();
  c.load(['./definitions'], 'process.proto');
  poolClients.push(c);
}

export function setup() {
  return {};
}

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

  // Teste gRPC usando cliente k6/net/grpc (evita proxy HTTP)
  const startGRPC = new Date();
  try {
    // escolhe cliente do pool por round-robin para reduzir conexões
    const vuIndex = (typeof __VU !== 'undefined') ? (__VU - 1) : 0;
    const clientIndex = vuIndex % poolClients.length;
    const client = poolClients[clientIndex];
    console.log('Iniciando chamada gRPC (pool index=' + clientIndex + ')...');
    console.log('Payload:', JSON.stringify(payload));

    // se client não conectado, tenta conectar com stagger/flag para evitar bursts
    if (!poolConnected[clientIndex]) {
      // se outro VU já está conectando, espera até conectado ou timeout
      const maxWaitMs = 2000;
      const startWait = Date.now();
      if (poolConnecting[clientIndex]) {
        while (poolConnecting[clientIndex] && (Date.now() - startWait) < maxWaitMs) {
          // espera curtos sem bloquear demais
          sleep(0.01);
        }
      } else {
        // marca que está conectando e aplica stagger baseado no clientIndex
        poolConnecting[clientIndex] = true;
        const jitter = Math.random() * 1000; // up to 1s
        const staggerMs = (clientIndex % 10) * 100; // 0..900ms
        sleep((jitter + staggerMs) / 1000);
        // tentativa com retries curtos
        const maxRetries = 3;
        let connected = false;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            client.connect('127.0.0.1:50052', { plaintext: true });
            poolConnected[clientIndex] = true;
            connected = true;
            break;
          } catch (connErr) {
            console.error('Tentativa de conectar client pool index', clientIndex, 'falhou (attempt', attempt, '):', connErr);
            sleep(0.1 * attempt);
          }
        }
        poolConnecting[clientIndex] = false;
        if (!connected) {
          // registra e prossegue — checks irão capturar falhas de invoke
          console.error('Não foi possível conectar client pool index', clientIndex);
        }
      }
    }

    const resGRPC = client.invoke('processing.ProcessingService/ProcessData', payload);
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
    errorRate.add(1);
  }

  sleep(1);
}

export function teardown(data) {
  try {
    for (let i = 0; i < poolClients.length; i++) {
      const c = poolClients[i];
      if (c) {
        try { c.close(); } catch (e) { /* ignora */ }
      }
    }
  } catch (error) {
    console.error('Erro ao fechar clientes gRPC no teardown:', error);
  }
}
