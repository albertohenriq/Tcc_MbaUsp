import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

export let options = {
  vus: 100,
  duration: '3m',
  thresholds: {
    'errors': ['rate<0.1'], // error rate should be less than 10%
    'grpc_req_duration': ['p(95)<1000'], // 95% of requests should complete below 1s
  },
};

const client = new grpc.Client();
client.load(['../../src/service-a-nodejs/proto'], 'processing.proto');

export default function () {
  client.connect('localhost:50051', {
    plaintext: true,
  });

  const data = {
    field1: 'test data for processing',
    field2: 'grpc test',
    field3: Date.now() % 1000000, // Convert to int32 range
    field4: true,
    field5: ['item1', 'item2'],
    field6: { key1: 'value1', key2: 'value2' },
    field7: `req-${Math.random().toString(36).substr(2, 9)}`,
    field8: Math.random() * 100,
    field9: 'additional_data',
    field10: 'test_field'
  };

  // gRPC call to Service A
  let response = client.invoke('processing.ProcessingService/ProcessData', data);
  
  let success = check(response, {
    'status is OK': (r) => r.status === grpc.StatusOK,
    'response has success': (r) => r.message && r.message.success === true,
  });

  errorRate.add(!success);
  
  client.close();
  sleep(1);
}
