import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Métricas customizadas para resiliência gRPC
const errors = new Counter('errors');
const fallbacks = new Counter('fallbacks');
const degradedRequests = new Counter('degraded_requests');
const recoveryTime = new Trend('recovery_time');
const throughputDegradation = new Trend('throughput_degradation');

// Circuit Breaker state
let circuitBreakerState = 'CLOSED';
let failureCount = 0;
let lastFailureTime = 0;
let recoveryStartTime = 0;
let baselineThroughput = 0;
let currentThroughput = 0;

export const options = {
    scenarios: {
        resilience_test: {
            executor: 'constant-vus',
            vus: 500,
            duration: '120s', // 2 minutos para permitir simulação de falhas
            gracefulStop: '30s'
        }
    },
    thresholds: {
        errors: ['rate<0.5'], // Máximo 50% de erro para trigger do circuit breaker
        http_req_duration: ['p(95)<10000'], // 95% das requisições em menos de 10s
    }
};

// Função para injetar latência artificial
function artificialLatency() {
    const now = Date.now();
    const testStartTime = __ENV.TEST_START_TIME || now;
    const elapsedSeconds = (now - testStartTime) / 1000;
    
    // Injetar 2s de latência entre 30s e 90s
    if (elapsedSeconds >= 30 && elapsedSeconds <= 90) {
        console.log(`💥 Injetando latência artificial gRPC: 2s (tempo: ${elapsedSeconds}s)`);
        sleep(2);
        return true;
    }
    return false;
}

// Circuit Breaker logic
function shouldOpenCircuitBreaker() {
    const now = Date.now();
    const timeWindow = 10000; // 10 segundos
    
    if (failureCount >= 5 && (now - lastFailureTime) < timeWindow) {
        const errorRate = failureCount / 10;
        if (errorRate >= 0.5) {
            console.log(`🔴 gRPC Circuit Breaker ABERTO - ${failureCount} falhas em ${timeWindow/1000}s`);
            return true;
        }
    }
    return false;
}

function canRetry() {
    const now = Date.now();
    const retryDelay = 5000; // 5 segundos
    
    if (circuitBreakerState === 'OPEN' && (now - lastFailureTime) > retryDelay) {
        console.log('🟡 gRPC Circuit Breaker MEIO-ABERTO - Tentando recuperação');
        circuitBreakerState = 'HALF_OPEN';
        recoveryStartTime = now;
        return true;
    }
    return circuitBreakerState !== 'OPEN';
}

// Fallback response para gRPC
function fallbackResponse() {
    fallbacks.add(1);
    degradedRequests.add(1);
    console.log('⚠️ Executando fallback gRPC devido à falha');
    
    return {
        status: 200,
        body: JSON.stringify({
            success: true,
            message: 'Fallback response - serviço gRPC temporariamente indisponível',
            degraded: true,
            protocol: 'grpc-fallback',
            timestamp: new Date().toISOString()
        }),
        headers: { 'Content-Type': 'application/grpc+json' },
        timings: { duration: 150 } // Fallback ligeiramente mais lento que REST
    };
}

// Medição de throughput
let requestCount = 0;
let lastThroughputCheck = Date.now();

function measureThroughput() {
    const now = Date.now();
    const elapsed = (now - lastThroughputCheck) / 1000;
    
    if (elapsed >= 10) {
        currentThroughput = requestCount / elapsed;
        
        if (baselineThroughput === 0) {
            baselineThroughput = currentThroughput;
        } else {
            const degradation = ((baselineThroughput - currentThroughput) / baselineThroughput) * 100;
            if (degradation > 0) {
                throughputDegradation.add(degradation);
                console.log(`📉 gRPC Degradação do throughput: ${degradation.toFixed(1)}% (baseline: ${baselineThroughput.toFixed(1)}, atual: ${currentThroughput.toFixed(1)})`);
            }
        }
        
        requestCount = 0;
        lastThroughputCheck = now;
    }
}

export default function() {
    requestCount++;
    measureThroughput();
    
    // Verificar circuit breaker
    if (!canRetry()) {
        const fallback = fallbackResponse();
        check(fallback, {
            'fallback response': (f) => f.status === 200,
        });
        sleep(0.1);
        return;
    }
    
    // Injetar latência artificial
    const hasArtificialLatency = artificialLatency();
    
    const startTime = Date.now();
    
    try {
        // Fazer requisição gRPC via HTTP
        const response = http.post('http://localhost:3000/grpc/process', 
            JSON.stringify({
                data: `grpc-resilience-test-${__VU}-${__ITER}`,
                timestamp: new Date().toISOString(),
                test_type: 'resilience_grpc'
            }), 
            {
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Protocol': 'grpc'
                },
                timeout: '30s'
            }
        );
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Verificar sucesso da resposta gRPC
        const isSuccess = check(response, {
            'gRPC status is 200': (r) => r.status === 200,
            'gRPC response time < 30s': (r) => r.timings.duration < 30000,
            'gRPC response has data': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body && (body.success === true || body.status === 'success');
                } catch (e) {
                    return false;
                }
            },
        });
        
        // Detectar falhas
        if (!isSuccess || response.status !== 200 || duration > 10000 || hasArtificialLatency) {
            errors.add(1);
            failureCount++;
            lastFailureTime = Date.now();
            
            console.log(`❌ gRPC Falha detectada - Status: ${response.status}, Duração: ${duration}ms, Latência artificial: ${hasArtificialLatency}`);
            
            if (shouldOpenCircuitBreaker()) {
                circuitBreakerState = 'OPEN';
                console.log('🔴 gRPC Circuit Breaker ABERTO');
            }
        } else {
            // Sucesso - verificar recuperação
            if (circuitBreakerState === 'HALF_OPEN') {
                circuitBreakerState = 'CLOSED';
                const recoveryDuration = Date.now() - recoveryStartTime;
                recoveryTime.add(recoveryDuration);
                console.log(`🟢 gRPC Circuit Breaker FECHADO - Recuperação em ${recoveryDuration}ms`);
                failureCount = 0;
            }
        }
        
    } catch (error) {
        errors.add(1);
        failureCount++;
        lastFailureTime = Date.now();
        console.log(`💥 gRPC Erro de conexão: ${error.message}`);
        
        // Executar fallback
        const fallback = fallbackResponse();
        check(fallback, {
            'fallback executed': (f) => f.status === 200,
        });
        
        if (shouldOpenCircuitBreaker()) {
            circuitBreakerState = 'OPEN';
        }
    }
    
    sleep(0.1);
}

export function setup() {
    console.log('🚀 Iniciando teste de resiliência gRPC');
    console.log('⚙️ Configuração: 500 VUs, Circuit Breaker ativo, Latência 2s entre 30-90s');
    console.log('🔗 Endpoint: http://localhost:3000/grpc/process');
    
    __ENV.TEST_START_TIME = Date.now();
    
    return { testStartTime: Date.now() };
}

export function teardown(data) {
    console.log('📊 Teste de Resiliência gRPC Finalizado');
    console.log(`⚡ Circuit Breaker Estado Final: ${circuitBreakerState}`);
    console.log(`💥 Total de Falhas: ${failureCount}`);
    console.log(`🔄 Throughput Baseline: ${baselineThroughput.toFixed(1)} req/s`);
    console.log(`📈 Throughput Final: ${currentThroughput.toFixed(1)} req/s`);
}
