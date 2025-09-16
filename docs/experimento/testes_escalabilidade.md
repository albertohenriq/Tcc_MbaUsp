# Testes de Escalabilidade

Este documento detalha a execução dos testes de escalabilidade com diferentes números de instâncias do Serviço B.

## 1. Configuração de Escalabilidade

### 1.1 Docker Compose

```yaml
# Configuração para escalabilidade do Serviço B
services:
  service-b:
    build:
      context: ./src/service-b-python
      dockerfile: Dockerfile
    deploy:
      replicas: 1  # Será alterado nos testes
    ports:
      - "3001-3008:3001"  # Range de portas para múltiplas instâncias
      - "50052-50059:50052"  # Range de portas gRPC
```

### 1.2 Configuração de Load Balancing

```yaml
# Configuração do nginx para load balancing
services:
  nginx:
    image: nginx:latest
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "8080:80"
    depends_on:
      - service-b
```

## 2. Cenários de Teste

### 2.1 Teste com 1 Instância (Base)

```bash
# Configurar uma instância
docker-compose up -d --scale service-b=1

# Executar teste de carga
k6 run k6-tests/scale-test.js
```

### 2.2 Teste com 2 Instâncias

```bash
# Escalar para duas instâncias
docker-compose up -d --scale service-b=2

# Executar teste de carga
k6 run k6-tests/scale-test.js
```

### 2.3 Teste com 4 Instâncias

```bash
# Escalar para quatro instâncias
docker-compose up -d --scale service-b=4

# Executar teste de carga
k6 run k6-tests/scale-test.js
```

### 2.4 Teste com 8 Instâncias

```bash
# Escalar para oito instâncias
docker-compose up -d --scale service-b=8

# Executar teste de carga
k6 run k6-tests/scale-test.js
```

## 3. Script de Teste (k6)

```javascript
// k6-tests/scale-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '1m', target: 500 },    // Ramp-up para 500 usuários
    { duration: '5m', target: 500 },    // Manter carga
    { duration: '1m', target: 0 },      // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% das requisições < 1s
    'http_req_failed': ['rate<0.01'],    // Menos de 1% de erros
  },
};

const payload = {
  // ... payload de teste
};

export default function () {
  // Teste REST
  const resREST = http.post('http://localhost:8080/api/process',
    JSON.stringify(payload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(resREST, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

## 4. Métricas de Escalabilidade

### 4.1 Métricas por Instância

```promql
# CPU por instância
sum(rate(process_cpu_seconds_total{job="service-b"}[5m])) by (instance)

# Memória por instância
sum(process_resident_memory_bytes{job="service-b"}) by (instance)

# Requisições por instância
sum(rate(http_requests_total{job="service-b"}[5m])) by (instance)
```

### 4.2 Métricas Agregadas

```promql
# Throughput total
sum(rate(http_requests_total{job="service-b"}[5m]))

# Latência média global
avg(rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m]))

# Distribuição de carga
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

## 5. Análise de Escalabilidade

### 5.1 Tabela de Resultados

| Métrica                    | 1 Instância | 2 Instâncias | 4 Instâncias | 8 Instâncias |
|---------------------------|-------------|--------------|--------------|--------------|
| Throughput Máximo (req/s) |             |              |              |              |
| Latência Média (ms)       |             |              |              |              |
| CPU por Instância (%)     |             |              |              |              |
| Memória por Instância (MB)|             |              |              |              |
| Taxa de Erro (%)          |             |              |              |              |

### 5.2 Análise de Desempenho

1. **Ganho Linear**
   - Calcular o fator de escala real vs. ideal
   - Identificar pontos de saturação
   - Analisar overhead de comunicação

2. **Eficiência de Recursos**
   - Avaliar uso de recursos por instância
   - Identificar custos de escalabilidade
   - Determinar ponto ótimo de operação

3. **Limitações**
   - Identificar gargalos
   - Analisar impacto da rede
   - Avaliar limitações do hardware

### 5.3 Recomendações

1. **Configuração Ótima**
   - Número ideal de instâncias
   - Configuração de recursos
   - Estratégia de scaling

2. **Melhorias Propostas**
   - Otimizações de código
   - Ajustes de infraestrutura
   - Recomendações de deployment
