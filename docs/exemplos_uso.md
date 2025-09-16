# Exemplos de Uso dos Serviços

Este documento contém exemplos práticos de como utilizar os serviços implementados.

## 1. Exemplos de Requisições REST

### 1.1 Serviço A (Gateway)

**Enviar dados para processamento**:
```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "field1": "exemplo1",
    "field2": "exemplo2",
    "field3": 123,
    "field4": true,
    "field5": ["item1", "item2"],
    "field6": {"chave": "valor"},
    "field7": "2025-09-07T00:00:00Z",
    "field8": 456.78,
    "field9": "exemplo9",
    "field10": "exemplo10"
  }'
```

**Verificar saúde do serviço**:
```bash
curl http://localhost:3000/health
```

**Obter métricas**:
```bash
curl http://localhost:3000/metrics
```

### 1.2 Serviço B (Processamento)

**Verificar status do processamento**:
```bash
curl http://localhost:3001/health
```

**Obter métricas de processamento**:
```bash
curl http://localhost:3001/metrics
```

### 1.3 Serviço C (Armazenamento)

**Consultar dado armazenado**:
```bash
curl http://localhost:3002/api/data/{processedId}
```

## 2. Exemplos de Chamadas gRPC

### 2.1 Usando grpcurl

**Instalar grpcurl**:
```bash
# Windows (com Chocolatey)
choco install grpcurl

# Linux
wget https://github.com/fullstorydev/grpcurl/releases/download/v1.8.7/grpcurl_1.8.7_linux_x86_64.tar.gz
```

**Listar serviços disponíveis**:
```bash
grpcurl -plaintext localhost:50051 list
```

**Enviar requisição para o Serviço A**:
```bash
grpcurl -plaintext -d '{
  "field1": "exemplo1",
  "field2": "exemplo2",
  "field3": 123,
  "field4": true,
  "field5": ["item1", "item2"],
  "field6": {"chave": "valor"},
  "field7": "2025-09-07T00:00:00Z",
  "field8": 456.78,
  "field9": "exemplo9",
  "field10": "exemplo10"
}' localhost:50051 processing.ProcessingService/ProcessData
```

## 3. Monitoramento

### 3.1 Acessar Dashboards

1. **Grafana**:
   - URL: http://localhost:3010
   - Login padrão: admin/admin
   - Dashboards disponíveis:
     - Overview
     - Performance
     - Resources

2. **Prometheus**:
   - URL: http://localhost:9090
   - Queries úteis:
     - `rate(http_request_duration_seconds_count[5m])`
     - `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
     - `process_resident_memory_bytes`

### 3.2 Logs dos Serviços

**Visualizar logs do Serviço A**:
```bash
docker-compose logs -f service-a
```

**Visualizar logs do Serviço B**:
```bash
docker-compose logs -f service-b
```

**Visualizar logs do Serviço C**:
```bash
docker-compose logs -f service-c
```

## 4. Testes de Carga

### 4.1 Executar Testes com k6

**Teste básico de carga**:
```bash
k6 run k6-tests/load-test.js
```

**Teste de escalabilidade**:
```bash
# Primeiro, escale o Serviço B
docker-compose up -d --scale service-b=4

# Depois execute o teste
k6 run k6-tests/scale-test.js
```

### 4.2 Simular Falhas

**Desligar um serviço**:
```bash
docker-compose stop service-b
```

**Adicionar latência de rede**:
```bash
docker-compose exec service-b tc qdisc add dev eth0 root netem delay 100ms
```

**Remover latência de rede**:
```bash
docker-compose exec service-b tc qdisc del dev eth0 root
```

## 5. Limpeza do Ambiente

**Parar todos os serviços**:
```bash
docker-compose down
```

**Limpar volumes**:
```bash
docker-compose down -v
```

**Remover imagens**:
```bash
docker-compose down --rmi all
```
