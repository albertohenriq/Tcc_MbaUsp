# Testes de Resiliência

Este documento detalha a execução dos testes de resiliência e comportamento do sistema em falhas.

## 1. Circuit Breaker

### 1.1 Implementação REST (Node.js)

```javascript
const CircuitBreaker = require('opossum');

const breaker = new CircuitBreaker(async function request() {
  // Função que faz a requisição
}, {
  timeout: 3000, // 3 segundos
  errorThresholdPercentage: 50,
  resetTimeout: 5000
});

breaker.fallback(() => {
  return { error: 'Serviço indisponível', fallback: true };
});

breaker.on('success', (result) => {
  console.log('Success:', result);
});

breaker.on('timeout', () => {
  console.log('Timeout');
});

breaker.on('reject', () => {
  console.log('Circuit Breaker está aberto');
});
```

### 1.2 Implementação gRPC (Python)

```python
from grpc import StatusCode
from grpc_status import rpc_status
from google.rpc import code_pb2, status_pb2

class CircuitBreakerInterceptor(grpc.ServerInterceptor):
    def __init__(self):
        self._failure_count = 0
        self._is_open = False
        self._last_failure_time = None
        
    def intercept_service(self, continuation, handler_call_details):
        if self._is_open:
            if time.time() - self._last_failure_time > 5:  # 5s reset
                self._is_open = False
                self._failure_count = 0
            else:
                return self._create_error_response()
                
        return continuation(handler_call_details)
        
    def _create_error_response(self):
        status = status_pb2.Status(
            code=code_pb2.UNAVAILABLE,
            message='Circuit breaker está aberto'
        )
        return rpc_status.to_status(status)
```

## 2. Cenários de Teste

### 2.1 Falha do Serviço B

```python
# Simular falha no Serviço B
def simulate_service_failure():
    # Falha controlada
    time.sleep(2)  # Simula processamento lento
    if random.random() < 0.5:  # 50% de chance de falha
        raise Exception("Falha simulada")
```

### 2.2 Script de Teste (k6)

```javascript
// k6-tests/resilience-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '1m', target: 500 },  // Ramp-up
    { duration: '3m', target: 500 },  // Steady load
    { duration: '1m', target: 0 },    // Ramp-down
  ],
};

const errorRate = new Rate('errors');

export default function () {
  const res = http.post('http://localhost:3000/api/process', payload);
  
  check(res, {
    'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  }) || errorRate.add(1);
  
  sleep(1);
}
```

## 3. Execução dos Testes

### 3.1 Teste de Circuit Breaker

1. Iniciar serviços normalmente
2. Executar carga base (500 usuários)
3. Injetar falhas no Serviço B
4. Verificar ativação do circuit breaker
5. Monitorar recuperação

```bash
# Iniciar teste
k6 run k6-tests/resilience-test.js

# Injetar falha (em outro terminal)
docker-compose exec service-b python3 -c "import time; time.sleep(30)"
```

### 3.2 Teste de Recuperação

1. Esperar circuit breaker abrir
2. Restaurar serviço
3. Verificar tempo de recuperação
4. Monitorar taxa de sucesso

## 4. Métricas de Resiliência

### 4.1 Circuit Breaker

```promql
# Estado do Circuit Breaker
circuit_breaker_state{service="service-b"}

# Taxa de falhas
rate(circuit_breaker_failures_total[1m])

# Tempo em estado aberto
circuit_breaker_open_duration_seconds
```

### 4.2 Métricas de Falha

```promql
# Taxa de erros
rate(http_request_errors_total[1m])

# Tempo de resposta durante falhas
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{status="error"}[1m]))

# Requisições em fallback
rate(circuit_breaker_fallback_total[1m])
```

## 5. Análise de Resiliência

### 5.1 Tabela de Resultados

| Métrica                          | REST     | gRPC     |
|----------------------------------|----------|----------|
| Tempo até CB abrir               |          |          |
| Tempo de recuperação             |          |          |
| % Requisições em fallback        |          |          |
| Latência durante falhas          |          |          |
| Taxa de erro durante falhas      |          |          |

### 5.2 Análise Qualitativa

1. **Detecção de Falhas**
   - Tempo até identificação
   - Precisão da detecção
   - Falsos positivos/negativos

2. **Isolamento de Falhas**
   - Efetividade do circuit breaker
   - Impacto em outros serviços
   - Propagação de falhas

3. **Recuperação**
   - Tempo de recuperação
   - Estabilidade após recuperação
   - Comportamento do fallback

### 5.3 Recomendações

1. **Configuração do Circuit Breaker**
   - Thresholds ideais
   - Timeouts
   - Estratégias de retry

2. **Melhorias de Resiliência**
   - Ajustes de timeout
   - Estratégias de fallback
   - Monitoramento proativo

3. **Práticas Recomendadas**
   - Logging aprimorado
   - Alertas proativos
   - Procedimentos de recuperação
