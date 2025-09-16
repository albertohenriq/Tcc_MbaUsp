# 🚀 Comparação de Performance: REST vs gRPC - TCC

Este projeto implementa um **ambiente completo de testes** para comparação empírica de desempenho entre protocolos **REST (HTTP/JSON)** e **gRPC (HTTP/2/Protobuf)** em uma arquitetura de microserviços.

## 🎯 Objetivos do Projeto

- **Análise Quantitativa**: Comparação de latência, throughput e recursos
- **Análise Qualitativa**: Facilidade de implementação, manutenibilidade e curva de aprendizado
- **Testes Práticos**: Cenários reais de escalabilidade e resiliência
- **Recomendações**: Guidelines para escolha de protocolo baseado em dados empíricos

## 🏗️ Arquitetura Implementada

### Infraestrutura
- **Hardware**: Dell i7, 16GB RAM, SSD
- **Plataforma**: Docker Desktop + WSL2
- **Monitoramento**: Prometheus + Grafana + cAdvisor

### Microserviços
- **Serviço A (Node.js)**: Gateway/API Layer - Suporte REST + gRPC
- **Serviço B (Python)**: Processing Service - Lógica de negócio
- **Serviço C (Node.js)**: Storage/Backend - Persistência de dados

### Stack Tecnológica
- **Containerização**: Docker + Docker Compose
- **Monitoramento**: Prometheus + Grafana + cAdvisor
- **Testes**: k6 (Load Testing) + Scripts de Análise Python
- **Protocolos**: REST (Express.js) + gRPC (Protocol Buffers)
- **Observabilidade**: Dashboards tempo real + Análise de logs

## 📁 Estrutura do Projeto

```
FinalTcc/
├── 📦 src/                                    # Código fonte dos microserviços
│   ├── service-a-nodejs/                      # Gateway (REST + gRPC)
│   │   ├── src/index.js
│   │   ├── package.json
│   │   └── proto/processing.proto
│   ├── service-b-python/                      # Processing Service
│   │   ├── app/main.py
│   │   ├── app/grpc_server.py
│   │   ├── requirements.txt
│   │   └── proto/processing.proto
│   └── service-c-nodejs/                      # Storage Service
│       ├── src/index.js
│       └── package.json
├── 🐳 docker/                                 # Configurações de monitoramento
│   ├── grafana/
│   │   ├── dashboards/                        # Dashboards pré-configurados
│   │   └── datasources/
│   └── prometheus/
│       └── prometheus.yml                     # Configuração de métricas
├── 🧪 k6-tests/                               # Scripts de teste de carga
│   ├── monitoring-collection-test.js          # Teste principal de monitoramento
│   ├── comparison/                            # Testes comparativos
│   ├── final/                                 # Testes finais validados
│   └── *.js                                   # Diversos cenários de teste
├── 📊 docs/                                   # Documentação técnica
│   ├── arquitetura_servicos.md
│   ├── exemplos_uso.md
│   └── experimento/                           # Planos e resultados
├── 🚀 Scripts de Execução                     # Automação de testes
│   ├── run_simple_monitoring.ps1             # Monitoramento completo
│   ├── run_scalability_tests.ps1             # Testes de escalabilidade
│   ├── run_resilience_tests.ps1              # Testes de resiliência
│   └── preparar_github.ps1                   # Setup para GitHub
├── 🔍 Scripts de Análise                      # Processamento de dados
│   ├── analyze_k6_logs_fixed.py              # Análise de logs k6
│   ├── analise_forma_comparativa.py          # Análise comparativa
│   └── gerar_tabelas_executivas.py           # Geração de tabelas
├── 📋 Relatórios e Documentação
│   ├── 5_FORMA_DE_ANALISE_COMPLETA.md        # Análise comparativa final
│   ├── RELATORIO_COLETA_DADOS_COMPLETO.md    # Relatório de coleta
│   ├── RESUMO_EXECUTIVO_5_FORMA_ANALISE.md   # Resumo executivo
│   └── *.csv                                  # Tabelas de dados
├── docker-compose.yml                         # Orquestração completa
├── .gitignore                                 # Configuração Git
└── README.md                                  # Este arquivo
```

## 🚀 Como Executar os Testes

### Pré-requisitos
- **Docker Desktop** instalado e funcionando
- **Node.js** v16+ (para desenvolvimento local)
- **Python** 3.8+ (para scripts de análise)
- **k6** para testes de carga
- **PowerShell** (Windows) ou **Bash** (Linux/Mac)

### 1. Setup Inicial
```powershell
# Clone o repositório
git clone https://github.com/SEU_USUARIO/final-tcc.git
cd final-tcc

# Inicie o ambiente completo
docker-compose up -d
```

### 2. Execução Automatizada (Recomendado)
```powershell
# Teste completo de monitoramento (26 min)
.\run_simple_monitoring.ps1

# Testes de escalabilidade (4 configurações)
.\run_scalability_tests.ps1

# Testes de resiliência
.\run_resilience_tests.ps1
```

### 3. Execução Manual
```powershell
# Teste REST vs gRPC básico
k6 run k6-tests/monitoring-collection-test.js

# Teste de escalabilidade específico
k6 run k6-tests/comparison/rest-vs-grpc-500.js

# Teste de resiliência
k6 run k6-tests/resilience-rest-test.js
```

### 4. Análise de Resultados
```powershell
# Análise automática de logs k6
python analyze_k6_logs_fixed.py

# Geração de análise comparativa
python analise_forma_comparativa.py

# Criação de tabelas executivas
python gerar_tabelas_executivas.py
```

### 5. Acesso aos Dashboards
- **Grafana**: http://localhost:3010 (admin/admin)
- **Prometheus**: http://localhost:9090
- **cAdvisor**: http://localhost:8080
- **Service A**: http://localhost:3000

## 🧪 Cenários de Teste Implementados

### 1. 📊 Performance Comparativa
- **Cargas**: 100, 300, 500, 1000 usuários virtuais
- **Duração**: 26 minutos (teste completo de monitoramento)
- **Ramp-up**: 5 estágios de crescimento gradual
- **Payload**: Estrutura JSON/Protobuf com dados de processamento
- **Protocolos**: REST (HTTP/JSON) vs gRPC (HTTP/2/Protobuf)

### 2. 🔄 Escalabilidade Horizontal
- **Configurações**: 1, 2, 4, 8 réplicas do Serviço B
- **Carga**: 500 VUs por 10 minutos
- **Métricas**: Throughput, latência P95/P99, utilização de recursos
- **Objetivo**: Avaliar eficácia da escalabilidade horizontal

### 3. 🛡️ Resiliência e Recuperação
- **Cenário**: Falhas simuladas no Serviço B
- **Circuit Breaker**: Implementado e testado
- **Métricas**: Tempo de recuperação, degradação graceful
- **Patterns**: Timeout, retry, fallback

### 4. 📈 Monitoramento Contínuo
- **Duração**: Testes de 26+ minutos
- **Métricas**: CPU, memória, network I/O
- **Ferramentas**: Prometheus + Grafana + cAdvisor
- **Frequência**: Coleta a cada 15 segundos

## Coleta de Dados

### Métricas Coletadas
- Tempo médio de resposta
- Latência (p95, p99)
- Throughput (req/s)
- Taxa de erros
- Uso de CPU/memória
- Tempo de recuperação após falhas

### Visualização
- Dashboards Grafana
- Relatórios k6/JMeter
- Análise comparativa em gráficos

## Resultados Esperados

A análise final incluirá:
1. Comparação quantitativa de desempenho
2. Análise de escalabilidade
3. Avaliação de resiliência
4. Considerações sobre implementação e manutenção
5. Recomendações práticas de uso
