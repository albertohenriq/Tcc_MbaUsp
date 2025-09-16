# Resultados do Teste Comparativo: REST vs gRPC - 1000 Usuários

## Metodologia

### Configuração do Teste
- **Data de Execução**: 7 de setembro de 2025
- **Duração Total**: 9 minutos
- **Fases do Teste**:
  1. Rampa de subida: 2 minutos (0 → 1000 usuários)
  2. Carga constante: 5 minutos (1000 usuários)
  3. Rampa de descida: 2 minutos (1000 → 0 usuários)

### Endpoints Testados
1. **REST**: `http://localhost:3000/api/process`
   - Método: POST
   - Content-Type: application/json

2. **gRPC**: `http://localhost:3000/grpc/process` 
   - Método: POST via proxy HTTP
   - Content-Type: application/json
   - Header especial: X-Protocol: grpc

## Resultados

### Métricas Principais
- **Duração total do teste**: 9m01.4s
- **Total de iterações**: 50,911
- **Taxa de erro total**: 50%

### Análise Detalhada

1. **REST Performance**:
   - Latência média: 6,300ms
   - Latência mínima: 103ms
   - Latência mediana: 8,116ms
   - Latência p95: 8,157ms (FALHOU - limite era 2000ms)
   - Taxa de falha: ~50%

2. **gRPC Performance**:
   - Latência média: 2.78ms
   - Latência mínima: 0ms
   - Latência mediana: 2ms
   - Latência p95: 6ms (PASSOU - limite era 2000ms)
   - Taxa de falha: 100% (todas as requisições falharam)

3. **Métricas de Rede**:
   - Dados recebidos: 44 MB (82 kB/s)
   - Dados enviados: 36 MB (67 kB/s)

### Problemas Identificados

1. **Falhas Críticas**:
   - REST: Latência p95 excedeu significativamente o limite (8,157ms vs 2000ms)
   - gRPC: 100% das requisições falharam com erro de status
   - Taxa de erro geral: 100% (excedeu o limite de 10%)

2. **Degradação de Performance**:
   - REST: Latência aumentou mais de 8x comparado ao teste com 500 usuários
   - Sistema não conseguiu manter a estabilidade sob carga
   - Timeouts e falhas de conexão generalizados

## Conclusões

1. **Limites do Sistema**
   - O sistema atingiu seu limite de capacidade bem antes dos 1000 usuários
   - Ambos os protocolos apresentaram falhas críticas
   - A infraestrutura atual não suporta esta carga

2. **Comparação com Testes Anteriores**
   
   | Métrica           | 100 usuários | 500 usuários | 1000 usuários |
   |-------------------|--------------|--------------|---------------|
   | REST p95 (ms)    | <500         | ~950         | 8,157        |
   | gRPC p95 (ms)    | <500         | ~850         | 6            |
   | Taxa Erro REST   | 0%           | 2%           | 50%          |
   | Taxa Erro gRPC   | 0%           | 1%           | 100%         |

3. **Problemas Identificados**
   - Possível esgotamento de conexões
   - Provável saturação de recursos do sistema
   - Falhas na gestão de concorrência

## Recomendações

1. **Melhorias Necessárias**
   - Implementar circuit breakers
   - Adicionar rate limiting
   - Otimizar configurações de conexão
   - Aumentar recursos de infraestrutura

2. **Próximos Passos**
   - Refazer teste com configurações otimizadas
   - Implementar melhorias de performance
   - Considerar escalabilidade horizontal
   - Realizar testes graduais (600, 700, 800 usuários)

## Observações Finais

O teste com 1000 usuários revelou que o sistema, em sua configuração atual, não está preparado para esta carga de trabalho. As falhas foram generalizadas e a degradação de performance foi severa. É necessário implementar melhorias significativas antes de considerar cargas desta magnitude.

### Limitações do Teste
- Ambiente local/containerizado
- Recursos computacionais limitados
- Ausência de otimizações específicas para alta carga
- Possíveis limitações de rede do ambiente de teste
