# Relatório de Testes de Carga — REST vs gRPC

Data: 09/09/2025
Workspace: `k6-tests/final`

## 1. Objetivo
Validar desempenho (latência e throughput) de um endpoint que expõe versão REST e gRPC com o cenário:
- Cargas: 100, 500, 1000 usuários simultâneos
- Duração: 5 minutos por rodada (mais ramp-up/down)
- Ramp-up: 30s
- Payload: JSON com 10 campos (REST) / Protobuf equivalente (gRPC)
- Métricas coletadas: tempo médio, p95, p99, throughput (req/s), taxa de erros (%)

## 2. Arquivos usados
- `rest-vs-grpc-100-fixed.js` — script k6 para 100 VUs (stages: 30s up, 5m steady, 30s down)
- `rest-vs-grpc-500.js` — script k6 para 500 VUs (stages) com pool lazy-connect (POOL_SIZE=20)
- `definitions/process.proto` — definição protobuf usada pelos scripts

Local: `C:\Users\Alberto\Desktop\FinalTcc\k6-tests\final`

## 3. Execuções realizadas
- 100 VUs: executei `k6 run rest-vs-grpc-100-fixed.js` (resultado completo no console)
- 500 VUs: executei anteriormente `k6 run rest-vs-grpc-500.js` (script com pool lazy-connect)
- 1000 VUs: executei via override: `k6 run --vus 1000 --duration 5m rest-vs-grpc-500.js`

> Nota: os comandos completos foram executados no PowerShell no diretório acima.

## 4. Métricas principais (resumo)
Os números abaixo são extraídos dos summaries do k6 para cada run.

### 100 VUs (`rest-vs-grpc-100-fixed.js`)
- Iterations: 14.927
- REST: avg ≈ 107 ms | p95 = 112 ms | p99 ≈ 119 ms
- gRPC: avg ≈ 110.6 ms | p95 = 118 ms | p99 ≈ 130 ms
- Throughput (média reportada pelo k6): ~41 req/s (http_reqs total 14.927 durante ~6m run com stages)
- Erros: http_req_failed = 0.00% | checks succeeded = 100%

Conclusão: 100 VUs atende os requisitos de latência/erro.

---

### 500 VUs (`rest-vs-grpc-500.js`)
- Iterations: 17.420
- REST: avg ≈ 3,76 s | p95 ≈ 4,09 s
- gRPC: avg ≈ 3,79 s | p95 ≈ 4,09 s
- Erros: checks succeeded = 100% (nenhum socket bind/buffer error neste run)

Conclusão: funcionalmente correto, porém latência p95 muito acima do objetivo — indica saturação.

---

### 1000 VUs (override `--vus 1000 --duration 5m` com `rest-vs-grpc-500.js`)
- Iterations: 16.133
- REST: avg ≈ 8,47 s | p95 ≈ 9,21 s
- gRPC: avg ≈ 9,02 s | p95 ≈ 9,31 s | p99 ≈ 9,68 s
- Erros: http_req_failed ≈ 4,74% | checks succeeded ≈ 97,57% | checks_failed ≈ 2,42%

Conclusão: latências extremas e taxa de erro visível → sistema saturado.

## 5. Observações técnicas
- Ajustes importantes aplicados nos scripts:
  - Proto carregado no contexto `init` (requisito do k6 para .load)
  - Substituição do proxy HTTP por chamadas gRPC diretas usando `k6/net/grpc` e `ProcessingService/ProcessData` como método
  - Estratégias de conexão exploradas: connect por chamada (falhas), connect em setup (falhas), 1 client por VU (parcial), e pool com lazy connect + jitter + retries (POOLSIZE=20) — este último eliminou erros de bind mas não resolve saturação de latência.

- O comportamento observado indica que as causas da degradação em 500/1000 VUs são provavelmente relacionadas a:
  - saturação do serviço alvo (CPU, I/O, banco, GC) OU
  - limites do host/k6 (ephemeral ports, limits de socket/TCP, CPU do cliente) OU
  - limite de rede/container virtualization.

## 6. Throughput real observado
- O k6 reporta `http_reqs` e métricas gRPC customizadas (`grpc_throughput`). Nos summaries das execuções foram observadas médias de req/s pequenas no caso de 100 VUs (~41 req/s observados durante as etapas/iters). Para throughput por segundo preciso exportar o resultado em JSON (`k6 run --out json=output.json ...`) para análise detalhada.

## 7. Recomendação de diagnóstico (passos imediatos)
1. Rodar um teste controlado (ex: 2 minutos) e coletar simultaneamente:
   - `docker logs --since` de `service-a` e `service-b` durante a janela
   - snapshot de CPU/mem do host k6 (task manager ou `typeperf`/`Get-Counter` no Windows)
   - estatísticas TCP (`netstat -an | findstr TIME_WAIT` ou equivalente)
   - opcional: top/htop nos containers (se possível)

2. Se bottleneck for client-side: dividir VUs em 2+ hosts k6, ajustar pool e pacing, ou aumentar SO ephemeral port range.
3. Se bottleneck for server-side: escalar service-b ou investigar latências internas (DB, I/O, bloqueios).

Posso automatizar a coleta acima e anexar os logs se autorizar.

## 8. Código usado (completo)
Abaixo estão os três arquivos usados exatamente como estão no workspace.

### rest-vs-grpc-100-fixed.js

```javascript
// Teste final comparativo REST vs gRPC - 100 usuários
import http from 'k6/http';
import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas personalizadas
const restLatency = new Trend('rest_latency');
const grpcLatency = new Trend('grpc_latency');
const restP99Latency = new Trend('rest_p99_latency');
const grpcP99Latency = new Trend('grpc_p99_latency');
const errorRate = new Rate('error_rate');
const restThroughput = new Trend('rest_throughput');
const grpcThroughput = new Trend('grpc_throughput');

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp-up: 30s
    { duration: '5m', target: 100 },   // Carga constante: 5min
    { duration: '30s', target: 0 },    // Ramp-down: 30s
  ],
  thresholds: {
    'rest_latency': ['p(95)<500'],     // Latência p95
    'grpc_latency': ['p(95)<500'],     // Latência p95
    'rest_p99_latency': ['p(99)<800'], // Latência p99
    'grpc_p99_latency': ['p(99)<800'], // Latência p99
    'error_rate': ['rate<0.1'],        // Taxa de erro < 10%
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

// carregamos o proto no contexto init (permitido)
const protoClient = new grpc.Client();
protoClient.load(['./definitions'], 'process.proto');

export function setup() {
  return {};
}

export default function (data) {
  // Teste REST
  const startREST = new Date();
  const resREST = http.post('http://localhost:3000/api/process', 
    JSON.stringify(payload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  const endREST = new Date();
  const restDuration = endREST - startREST;
  
  restLatency.add(restDuration);
  restP99Latency.add(restDuration);
  restThroughput.add(1);
  
  check(resREST, {
    'REST status is 200': (r) => r.status === 200,
    'REST response is valid': (r) => r.json('success') === true,
  }) || errorRate.add(1);

  sleep(1);

  // Teste gRPC
  const startGRPC = new Date();
  try {
    console.log('Iniciando chamada gRPC...');
    console.log('Payload:', JSON.stringify(payload));
  // usa o cliente carregado no init (`protoClient`) para invocar
  // não chamamos load aqui (deve estar no init) e não fechamos o protoClient por VU
  protoClient.connect('127.0.0.1:50052', { plaintext: true });
  const resGRPC = protoClient.invoke('processing.ProcessingService/ProcessData', payload);
  console.log('Resposta gRPC:', JSON.stringify(resGRPC));
    const endGRPC = new Date();
    const grpcDuration = endGRPC - startGRPC;
    
    grpcLatency.add(grpcDuration);
    grpcP99Latency.add(grpcDuration);
    grpcThroughput.add(1);
    
    check(resGRPC, {
      'gRPC status is OK': (r) => r && r.status === grpc.StatusOK,
      'gRPC response is valid': (r) => r && r.message && r.message.success === true,
    }) || errorRate.add(1);
  } catch (error) {
    console.error('Erro na chamada gRPC. Detalhes:', error);
    console.error('Stack:', error.stack);
    errorRate.add(1);
  }

  sleep(1);
}

export function teardown(data) {
  try {
    // fecha o cliente carregado no init se existir
    if (typeof protoClient !== 'undefined' && protoClient) {
      try { protoClient.close(); } catch (e) { /* ignora */ }
    }
  } catch (error) {
    console.error('Erro ao fechar cliente gRPC:', error);
  }
}
```

### rest-vs-grpc-500.js

```javascript
// Teste final comparativo REST vs gRPC - 500 usuários
import http from 'k6/http';
import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas personalizadas
const restLatency = new Trend('rest_latency');
const grpcLatency = new Trend('grpc_latency');
const restP99Latency = new Trend('rest_p99_latency');
const grpcP99Latency = new Trend('grpc_p99_latency');
const errorRate = new Rate('error_rate');
const restThroughput = new Trend('rest_throughput');
const grpcThroughput = new Trend('grpc_throughput');

export const options = {
  stages: [
    { duration: '30s', target: 500 },  // Ramp-up: 30s
    { duration: '5m', target: 500 },   // Carga constante: 5min
    { duration: '30s', target: 0 },    // Ramp-down: 30s
  ],
  thresholds: {
    'rest_latency': ['p(95)<1000'],    // Latência p95
    'grpc_latency': ['p(95)<1000'],    // Latência p95
    'rest_p99_latency': ['p(99)<1500'], // Latência p99
    'grpc_p99_latency': ['p(99)<1500'], // Latência p99
    'error_rate': ['rate<0.1'],        // Taxa de erro < 10%
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

// Criamos um pool menor de clientes gRPC e carregamos o proto no init
// Conexões serão feitas sob demanda (lazy) no primeiro uso com stagger/retry
const POOL_SIZE = 20; // reduzido para evitar bursts
const poolClients = [];
const poolConnected = new Array(POOL_SIZE).fill(false);
const poolConnecting = new Array(POOL_SIZE).fill(false);
for (let i = 0; i < POOL_SIZE; i++) {
  const c = new grpc.Client();
  c.load(['./definitions'], 'process.proto');
  poolClients.push(c);
}

export function setup() {
  return {};
}

export default function () {
  const startREST = new Date();
  const resREST = http.post('http://localhost:3000/api/process', 
    JSON.stringify(payload),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  const endREST = new Date();
  const restDuration = endREST - startREST;
  
  restLatency.add(restDuration);
  restP99Latency.add(restDuration);
  restThroughput.add(1);
  
  check(resREST, {
    'REST status is 200': (r) => r.status === 200,
    'REST response is valid': (r) => r.json('success') === true,
  }) || errorRate.add(1);

  sleep(1);

  // Teste gRPC usando cliente k6/net/grpc (evita proxy HTTP)
  const startGRPC = new Date();
  try {
    // escolhe cliente do pool por round-robin para reduzir conexões
    const vuIndex = (typeof __VU !== 'undefined') ? (__VU - 1) : 0;
    const clientIndex = vuIndex % poolClients.length;
    const client = poolClients[clientIndex];
    console.log('Iniciando chamada gRPC (pool index=' + clientIndex + ')...');
    console.log('Payload:', JSON.stringify(payload));

    // se client não conectado, tenta conectar com stagger/flag para evitar bursts
    if (!poolConnected[clientIndex]) {
      // se outro VU já está conectando, espera até conectado ou timeout
      const maxWaitMs = 2000;
      const startWait = Date.now();
      if (poolConnecting[clientIndex]) {
        while (poolConnecting[clientIndex] && (Date.now() - startWait) < maxWaitMs) {
          // espera curtos sem bloquear demais
          sleep(0.01);
        }
      } else {
        // marca que está conectando e aplica stagger baseado no clientIndex
        poolConnecting[clientIndex] = true;
        const jitter = Math.random() * 1000; // up to 1s
        const staggerMs = (clientIndex % 10) * 100; // 0..900ms
        sleep((jitter + staggerMs) / 1000);
        // tentativa com retries curtos
        const maxRetries = 3;
        let connected = false;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            client.connect('127.0.0.1:50052', { plaintext: true });
            poolConnected[clientIndex] = true;
            connected = true;
            break;
          } catch (connErr) {
            console.error('Tentativa de conectar client pool index', clientIndex, 'falhou (attempt', attempt, '):', connErr);
            sleep(0.1 * attempt);
          }
        }
        poolConnecting[clientIndex] = false;
        if (!connected) {
          // registra e prossegue — checks irão capturar falhas de invoke
          console.error('Não foi possível conectar client pool index', clientIndex);
        }
      }
    }

    const resGRPC = client.invoke('processing.ProcessingService/ProcessData', payload);
    console.log('Resposta gRPC:', JSON.stringify(resGRPC));
    const endGRPC = new Date();
    const grpcDuration = endGRPC - startGRPC;

    grpcLatency.add(grpcDuration);
    grpcP99Latency.add(grpcDuration);
    grpcThroughput.add(1);

    check(resGRPC, {
      'gRPC status is OK': (r) => r && r.status === grpc.StatusOK,
      'gRPC response is valid': (r) => r && r.message && r.message.success === true,
    }) || errorRate.add(1);
  } catch (error) {
    console.error('Erro na chamada gRPC. Detalhes:', error);
    errorRate.add(1);
  }

  sleep(1);
}

export function teardown(data) {
  try {
    for (let i = 0; i < poolClients.length; i++) {
      const c = poolClients[i];
      if (c) {
        try { c.close(); } catch (e) { /* ignora */ }
      }
    }
  } catch (error) {
    console.error('Erro ao fechar clientes gRPC no teardown:', error);
  }
}
```

### definitions/process.proto

```protobuf
syntax = "proto3";

package processing;

service ProcessingService {
  rpc ProcessData (ProcessRequest) returns (ProcessResponse);
}

message ProcessRequest {
  string field1 = 1;
  string field2 = 2;
  int32 field3 = 3;
  bool field4 = 4;
  repeated string field5 = 5;
  map<string, string> field6 = 6;
  string field7 = 7;
  double field8 = 8;
  string field9 = 9;
  string field10 = 10;
}

message ProcessResponse {
  string message = 1;
  bool success = 2;
  string processedId = 3;
  int64 timestamp = 4;
}
```

## 9. Como reproduzir os runs (comandos)
Use PowerShell no diretório `k6-tests/final`.

1) 100 VUs
```powershell
k6 run rest-vs-grpc-100-fixed.js
```

2) 500 VUs
```powershell
k6 run rest-vs-grpc-500.js
```

3) 1000 VUs (override)
```powershell
k6 run --vus 1000 --duration 5m rest-vs-grpc-500.js
```

Opcional: exportar JSON para análise posterior
```powershell
k6 run --out json=output-100.json rest-vs-grpc-100-fixed.js
```

## 10. Próximos passos sugeridos (executáveis)
- Se quiser um relatório mais formal (CSV ou Markdown com gráficos), eu gero a versão estendida e incluo o output JSON caso você confirme que quer que eu rode novamente com `--out json=...`.
- Se quiser diagnóstico: autorizo para coletar logs de containers e snapshots de TCP/CPU/mem durante um teste curto (eu executo os comandos e trago as saídas).

---

Arquivo gerado automaticamente por agente de testes no workspace.
