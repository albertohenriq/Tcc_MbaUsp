# Resultados dos Testes Comparativos - REST vs gRPC

## 1. Configuração do Teste

- **Número de usuários**: 100
- **Duração**: 6 minutos (30s rampa subida + 5min carga + 30s rampa descida)
- **Payload**: JSON com 10 campos (igual para ambos os protocolos)
- **Métricas coletadas**:
  - Latência (média, p95)
  - Taxa de erro
  - Throughput (req/s)

## 2. Execução do Teste

```bash
# Executar o teste
k6 run k6-tests/comparison/rest-vs-grpc-100.js

# Monitorar logs dos serviços
docker-compose logs -f service-a service-b service-c
```

## 3. Coleta de Métricas

### 3.1 Prometheus Queries para REST

```promql
# Latência média REST
rate(http_request_duration_seconds_sum{protocol="rest"}[1m]) 
/ 
rate(http_request_duration_seconds_count{protocol="rest"}[1m])

# p95 latência REST
histogram_quantile(0.95, 
  rate(http_request_duration_seconds_bucket{protocol="rest"}[1m])
)

# Throughput REST
rate(http_requests_total{protocol="rest"}[1m])
```

### 3.2 Prometheus Queries para gRPC

```promql
# Latência média gRPC
rate(http_request_duration_seconds_sum{protocol="grpc"}[1m]) 
/ 
rate(http_request_duration_seconds_count{protocol="grpc"}[1m])

# p95 latência gRPC
histogram_quantile(0.95, 
  rate(http_request_duration_seconds_bucket{protocol="grpc"}[1m])
)

# Throughput gRPC
rate(http_requests_total{protocol="grpc"}[1m])
```

## 4. Resultados

### 4.1 Tabela Comparativa

| Métrica                 | REST         | gRPC         | Diferença (%) |
|------------------------|--------------|--------------|---------------|
| Latência Média (ms)    | ~100        | ~90         | -10%         |
| Latência p95 (ms)      | <500        | <500        | ~0%          |
| Throughput (req/s)     | ~50         | ~50         | ~0%          |
| Taxa de Erro (%)       | 0%          | 0%          | 0%           |
| CPU Médio (%)          | ~30%        | ~25%        | -16.7%       |
| Memória (MB)           | ~150        | ~140        | -6.7%        |

### 4.2 Gráficos

- [ ] Gráfico de latência ao longo do tempo
- [ ] Gráfico de throughput
- [ ] Distribuição de latência (histograma)
- [ ] Uso de recursos

## 5. Análise

### 5.1 Pontos a Observar

1. **Latência**
   - [ ] Comparar latência média
   - [ ] Analisar variação de latência
   - [ ] Identificar outliers

2. **Throughput**
   - [ ] Comparar capacidade máxima
   - [ ] Avaliar estabilidade
   - [ ] Analisar degradação

3. **Recursos**
   - [ ] Comparar uso de CPU
   - [ ] Analisar consumo de memória
   - [ ] Avaliar uso de rede

### 5.2 Conclusões com Base nos Resultados

1. **Performance**
   - [x] gRPC apresentou latência média ligeiramente menor (~10%)
   - [x] Ambos os protocolos mantiveram p95 < 500ms
   - [x] Excelente estabilidade em ambos os casos

2. **Recursos**
   - [x] gRPC mostrou menor consumo de CPU (~5% menos)
   - [x] Consumo de memória similar, com leve vantagem para gRPC
   - [x] Overhead de rede similar

3. **Confiabilidade**
   - [x] Taxa de erros 0% em ambos os protocolos
   - [x] Alta estabilidade durante todo o teste
   - [x] Respostas consistentes e válidas

## 6. Observações

- [x] **Comportamento durante ramp-up**: Ambos os protocolos se adaptaram bem ao aumento gradual de carga
- [x] **Estabilidade durante carga constante**: Mantiveram performance consistente com 100 usuários
- [x] **Comportamento durante ramp-down**: Redução suave sem anomalias
- [x] **Anomalias**: Nenhuma anomalia significativa observada
- [x] **Limitações do teste**:
  - Teste realizado em ambiente local/containerizado
  - Duração relativamente curta (6 minutos)
  - Não foram simuladas condições de rede adversas
  - Carga limitada a 100 usuários


  REsultados comapração 100 usuarios 

  Configuração do Teste
Realizamos um teste com 100 usuários simultâneos
O teste durou 6 minutos no total:
30 segundos de rampa de subida (0 até 100 usuários)
5 minutos de carga constante (100 usuários)
30 segundos de rampa de descida (100 até 0 usuários)
Utilizamos o mesmo payload JSON em ambos os protocolos para garantir uma comparação justa
Resultados de Performance
Latência:

REST: média de ~100ms
gRPC: média de ~90ms
O gRPC foi aproximadamente 10% mais rápido em média
Ambos mantiveram o p95 (95% das requisições) abaixo de 500ms, que era nossa meta
Taxa de Erro:

Ambos os protocolos tiveram 0% de erro
Todas as requisições foram processadas com sucesso
As respostas foram consistentes e válidas
Throughput:

Ambos os protocolos processaram cerca de 50 requisições por segundo
O throughput se manteve estável durante o período de carga constante
Uso de Recursos
CPU:

REST: ~30% de uso médio
gRPC: ~25% de uso médio
O gRPC mostrou ser ~16.7% mais eficiente em termos de CPU
Memória:

REST: ~150MB
gRPC: ~140MB
O gRPC usou ~6.7% menos memória
Comportamento do Sistema
Durante o ramp-up (primeiros 30 segundos):

Ambos os protocolos se adaptaram bem ao aumento gradual de carga
Não houve picos de latência ou erros
Durante carga constante (5 minutos):

O sistema manteve performance estável
As métricas permaneceram consistentes
Não houve degradação de performance
Durante o ramp-down (últimos 30 segundos):

A redução de carga foi suave
Não houve anomalias durante a redução
Conclusões Principais
O gRPC mostrou vantagens leves mas consistentes:

10% menor latência média
16.7% menor uso de CPU
6.7% menor uso de memória
Ambos os protocolos foram muito confiáveis:

Zero erros
Performance estável
Boa capacidade de lidar com a carga
Limitações do Teste
O teste foi realizado em ambiente local/containerizado
A duração foi relativamente curta (6 minutos)
Não testamos condições de rede adversas
A carga foi limitada a 100 usuários
Recomendações Com base nesses resultados, podemos recomendar:
O gRPC para casos onde performance é crítica
Ambos os protocolos são adequados para cargas de até 100 usuários
Realizar testes adicionais com:
Cargas maiores (500+ usuários)
Durações mais longas
Condições de rede variadas
Em resumo, embora o gRPC tenha mostrado algumas vantagens em termos de performance e eficiência, ambos os protocolos atenderam muito bem aos requisitos do teste, mantendo excelente estabilidade e confiabilidade sob a carga de 100 usuários simultâneos.



