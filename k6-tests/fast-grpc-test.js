import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  vus: 50,
  duration: '1m',
  thresholds: {
    'errors': ['rate<0.1'],
    'grpc_req_duration': ['p(95)<1000'],
  },
};

const client = new grpc.Client();
client.load(['../src/service-a-nodejs/proto'], 'processing.proto');

export function setup() {
  // Setup inicial - conectar uma vez
  return {};
}

export default function () {
  // Conectar apenas se necessário
  if (!client.connected) {
    client.connect('localhost:50051', {
      plaintext: true,
    });
  }

  const data = {
    field1: 'test data for processing',
    field2: 'grpc test',
    field3: Date.now() % 1000000,
    field4: true,
    field5: ['item1', 'item2'],
    field6: { key1: 'value1', key2: 'value2' },
    field7: Math.random().toString(36).substr(2, 9),
    field8: Math.random() * 100,
    field9: 'additional_data',
    field10: 'test_field'
  };

  let response = client.invoke('processing.ProcessingService/ProcessData', data);
  
  let success = check(response, {
    'status is OK': (r) => r.status === grpc.StatusOK,
    'response has success': (r) => r.message && r.message.success === true,
  });

  errorRate.add(!success);
  
  // Remover sleep desnecessário e não fechar conexão a cada iteração
}

export function teardown() {
  // Fechar conexão apenas no final
  client.close();
}
