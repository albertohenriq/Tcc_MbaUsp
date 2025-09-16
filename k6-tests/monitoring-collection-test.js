import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Métricas customizadas
export let errorRate = new Rate('errors');
export let responseTime = new Trend('response_time');
export let requestCount = new Counter('requests_total');

// Configuração do teste
export let options = {
  scenarios: {
    rest_load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // Ramp up para 100 usuários
        { duration: '3m', target: 100 },   // Manter 100 usuários
        { duration: '2m', target: 200 },   // Ramp up para 200 usuários
        { duration: '3m', target: 200 },   // Manter 200 usuários
        { duration: '2m', target: 0 },     // Ramp down
      ],
      tags: { protocol: 'rest' },
    },
    grpc_load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '3m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '3m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      startTime: '14m',  // Inicia após o teste REST
      tags: { protocol: 'grpc' },
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% das requisições devem ser < 2s
    http_req_failed: ['rate<0.01'],    // Taxa de erro < 1%
    errors: ['rate<0.01'],
    response_time: ['p(95)<2000'],
  },
};

// Dados de teste
const testPayload = {
  message: "Performance test data",
  timestamp: new Date().toISOString(),
  userId: `user_${Math.floor(Math.random() * 1000)}`,
  data: {
    value: Math.floor(Math.random() * 100),
    type: "monitoring_test"
  }
};

export default function() {
  const protocol = __ENV.PROTOCOL || 'rest';
  let response;
  
  if (protocol === 'rest') {
    // Teste REST
    response = http.post('http://localhost:3000/api/process', JSON.stringify(testPayload), {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { 
        protocol: 'rest',
        endpoint: '/api/process'
      },
    });
    
    // Verificações específicas REST
    check(response, {
      'REST status is 200': (r) => r.status === 200,
      'REST response time < 5s': (r) => r.timings.duration < 5000,
      'REST response has success': (r) => JSON.parse(r.body).success === true,
      'REST response has timestamp': (r) => JSON.parse(r.body).timestamp !== undefined,
    });
    
  } else if (protocol === 'grpc') {
    // Teste gRPC (usando endpoint HTTP que simula gRPC)
    response = http.post('http://localhost:3000/grpc/process', JSON.stringify(testPayload), {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/grpc+json'
      },
      tags: { 
        protocol: 'grpc',
        endpoint: '/grpc/process'
      },
    });
    
    // Verificações específicas gRPC
    check(response, {
      'gRPC status is 200': (r) => r.status === 200,
      'gRPC response time < 5s': (r) => r.timings.duration < 5000,
      'gRPC response has protocol': (r) => JSON.parse(r.body).protocol === 'grpc-http',
      'gRPC has correct headers': (r) => r.headers['grpc-status'] === '0',
    });
  }
  
  // Métricas gerais
  errorRate.add(response.status !== 200);
  responseTime.add(response.timings.duration);
  requestCount.add(1);
  
  // Log para debugging
  if (response.status !== 200) {
    console.log(`Error: ${response.status} - ${response.body}`);
  }
  
  // Pausa entre requisições (simular comportamento real)
  sleep(Math.random() * 2 + 1); // 1-3 segundos
}

export function setup() {
  console.log('🚀 Iniciando teste de coleta de dados completa');
  console.log(`📊 Protocolo: ${__ENV.PROTOCOL || 'rest'}`);
  
  // Verificar se os serviços estão disponíveis
  let healthCheck = http.get('http://localhost:3000/health');
  if (healthCheck.status !== 200) {
    throw new Error('Service-A não está disponível');
  }
  
  console.log('✅ Serviços verificados e prontos');
}

export function teardown() {
  console.log('🏁 Teste concluído - dados coletados para análise');
}
