# Plano de Execução do Experimento

## 1. Visão Geral

Este documento detalha o passo a passo da execução do experimento de comparação entre REST e gRPC em uma arquitetura de microserviços.

## 2. Etapas do Experimento

### 2.1 Preparação do Ambiente

- [x] Configuração do ambiente Docker
- [x] Implementação dos três microserviços
- [x] Configuração do Kafka
- [x] Setup do Prometheus e Grafana
- [x] Implementação dos testes com k6

### 2.2 Testes de Carga (A Executar)

#### 2.2.1 REST
- [ ] 100 usuários simultâneos
- [ ] 500 usuários simultâneos
- [ ] 1000 usuários simultâneos

#### 2.2.2 gRPC
- [ ] 100 usuários simultâneos
- [ ] 500 usuários simultâneos
- [ ] 1000 usuários simultâneos

### 2.3 Testes de Escalabilidade (A Executar)

#### 2.3.1 REST
- [ ] 1 instância do Serviço B
- [ ] 2 instâncias do Serviço B
- [ ] 4 instâncias do Serviço B
- [ ] 8 instâncias do Serviço B

#### 2.3.2 gRPC
- [ ] 1 instância do Serviço B
- [ ] 2 instâncias do Serviço B
- [ ] 4 instâncias do Serviço B
- [ ] 8 instâncias do Serviço B

### 2.4 Testes de Resiliência (A Executar)

- [ ] Teste de Circuit Breaker
- [ ] Simulação de falhas no Serviço B
- [ ] Teste de recuperação após falha
- [ ] Análise de comportamento degradado

## 3. Coleta de Dados

### 3.1 Métricas a Serem Coletadas

1. **Performance**
   - Tempo médio de resposta
   - Latência (p95, p99)
   - Throughput (req/s)
   - Taxa de erros

2. **Recursos**
   - Uso de CPU
   - Consumo de memória
   - I/O de rede
   - I/O de disco

3. **Escalabilidade**
   - Tempo de resposta vs número de instâncias
   - Throughput vs número de instâncias
   - Overhead de recursos por instância

### 3.2 Formato dos Dados

Os dados serão coletados nos seguintes formatos:
- Logs do Prometheus (métricas brutas)
- Relatórios do k6 (JSON)
- Dashboards do Grafana (screenshots e exports)
- Logs dos serviços

## 4. Análise dos Resultados

### 4.1 Comparações a Serem Realizadas

1. **Performance Base**
   - REST vs gRPC em carga normal
   - REST vs gRPC em carga alta
   - Overhead de serialização

2. **Escalabilidade**
   - Ganho de performance por instância
   - Custo de recursos por instância
   - Limite de escalabilidade

3. **Resiliência**
   - Tempo de recuperação após falha
   - Efetividade do Circuit Breaker
   - Impacto no throughput durante falhas

### 4.2 Documentação dos Resultados

Os resultados serão documentados em:
1. Tabelas comparativas
2. Gráficos de performance
3. Análise qualitativa
4. Recomendações práticas
