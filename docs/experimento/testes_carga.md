# Execução dos Testes de Carga

Este documento detalha a execução dos testes de carga para comparação entre REST e gRPC.

## 1. Configuração do Ambiente de Testes

### 1.1 Hardware
- CPU: i7
- RAM: 16GB
- SSD
- Docker Desktop 24.x em Windows com WSL2

### 1.2 Software
- Node.js vXX para Serviços A e C
- Python vXX para Serviço B
- Docker Compose para orquestração
- k6 para testes de carga
- Prometheus/Grafana para monitoramento

### 1.3 Rede
- Ambiente local
- Docker bridge network
- Sem limites de bandwidth

## 2. Cenários de Teste

### 2.1 Teste de Carga Base (100 usuários)

```javascript
// k6-tests/base-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Rampa até 100 usuários
    { duration: '5m', target: 100 },  // Mantém 100 usuários
    { duration: '30s', target: 0 },   // Rampa down
  ],
  thresholds: {
    'errors': ['rate<0.1'],           // Taxa de erro < 10%
    'http_req_duration': ['p(95)<500'], // 95% das requisições < 500ms
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
  const resREST = http.post('http://localhost:3000/api/process', 
    JSON.stringify(payload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(resREST, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);
}
```

### 2.2 Teste de Carga Média (500 usuários)

```javascript
// k6-tests/medium-load.js
export const options = {
  stages: [
    { duration: '30s', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '30s', target: 0 },
  ],
  // ... resto do código similar ao base-load.js
};
```

### 2.3 Teste de Carga Alta (1000 usuários)

```javascript
// k6-tests/high-load.js
export const options = {
  stages: [
    { duration: '30s', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  // ... resto do código similar ao base-load.js
};
```

## 3. Coleta de Métricas

### 3.1 Prometheus Queries

```promql
# Latência média
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# p95 latência
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Throughput
rate(http_request_total[5m])

# Taxa de erros
rate(http_request_errors_total[5m])

# Uso de CPU
rate(process_cpu_seconds_total[5m])

# Uso de memória
process_resident_memory_bytes
```

### 3.2 Dashboard Grafana

1. Overview Panel:
   - Status dos serviços
   - Métricas principais
   - Alertas ativos

2. Performance Panel:
   - Latência por serviço
   - Throughput
   - Taxa de erros

3. Resources Panel:
   - CPU por serviço
   - Memória por serviço
   - Network I/O

## 4. Execução dos Testes

### 4.1 Preparação

```bash
# Limpar ambiente
docker-compose down -v

# Iniciar serviços
docker-compose up -d

# Verificar status
docker-compose ps
```

### 4.2 Execução

```bash
# Teste base (100 usuários)
k6 run k6-tests/base-load.js

# Teste médio (500 usuários)
k6 run k6-tests/medium-load.js

# Teste alto (1000 usuários)
k6 run k6-tests/high-load.js
```

### 4.3 Coleta de Resultados

```bash
# Exportar métricas do Prometheus
curl -G 'http://localhost:9090/api/v1/query_range' \
  --data-urlencode 'query=rate(http_request_duration_seconds_sum[5m])' \
  --data-urlencode 'start=2025-09-07T00:00:00Z' \
  --data-urlencode 'end=2025-09-07T01:00:00Z' \
  --data-urlencode 'step=15s'

# Exportar dashboard Grafana
# Via UI: Dashboard -> Share -> Export
```

## 5. Análise dos Resultados

### 5.1 Tabela Comparativa

| Métrica            | REST (100) | gRPC (100) | REST (500) | gRPC (500) | REST (1000) | gRPC (1000) |
|-------------------|------------|------------|------------|------------|-------------|-------------|
| Latência Média    |            |            |            |            |             |             |
| p95 Latência      |            |            |            |            |             |             |
| Throughput        |            |            |            |            |             |             |
| Taxa de Erro      |            |            |            |            |             |             |
| CPU Médio         |            |            |            |            |             |             |
| Memória Média     |            |            |            |            |             |             |

### 5.2 Análise Qualitativa

1. Performance
   - [ ] Comparar latência média
   - [ ] Analisar distribuição de latência
   - [ ] Avaliar throughput máximo
   - [ ] Identificar gargalos

2. Recursos
   - [ ] Comparar uso de CPU
   - [ ] Analisar consumo de memória
   - [ ] Avaliar eficiência de recursos

3. Confiabilidade
   - [ ] Analisar taxa de erros
   - [ ] Avaliar estabilidade
   - [ ] Verificar recuperação
