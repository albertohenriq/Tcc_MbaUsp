import http from 'k6/http';
import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Métricas customizadas para resiliência
const errors = new Counter('errors');
const fallbacks = new Counter('fallbacks');
const degradedRequests = new Counter('degraded_requests');
const recoveryTime = new Trend('recovery_time');
const throughputDegradation = new Trend('throughput_degradation');

// Circuit Breaker state
let circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
let failureCount = 0;
let lastFailureTime = 0;
let recoveryStartTime = 0;
let baselineThroughput = 0;
let currentThroughput = 0;

// Configuração
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

// Função para injetar latência artificial (simula degradação)
function artificialLatency() {
    const now = Date.now();
    const testStartTime = __ENV.TEST_START_TIME || now;
    const elapsedSeconds = (now - testStartTime) / 1000;
    
    // Injetar 2s de latência entre 30s e 90s (simula problema)
    if (elapsedSeconds >= 30 && elapsedSeconds <= 90) {
        console.log(`💥 Injetando latência artificial: 2s (tempo: ${elapsedSeconds}s)`);
        sleep(2); // 2 segundos de latência artificial
        return true;
    }
    return false;
}

// Circuit Breaker logic
function shouldOpenCircuitBreaker() {
    const now = Date.now();
    const timeWindow = 10000; // 10 segundos
    
    if (failureCount >= 5 && (now - lastFailureTime) < timeWindow) {
        const errorRate = failureCount / 10; // Aproximadamente 50%
        if (errorRate >= 0.5) {
            console.log(`🔴 Circuit Breaker ABERTO - ${failureCount} falhas em ${timeWindow/1000}s`);
            return true;
        }
    }
    return false;
}

function canRetry() {
    const now = Date.now();
    const retryDelay = 5000; // 5 segundos
    
    if (circuitBreakerState === 'OPEN' && (now - lastFailureTime) > retryDelay) {
        console.log('🟡 Circuit Breaker MEIO-ABERTO - Tentando recuperação');
        circuitBreakerState = 'HALF_OPEN';
        recoveryStartTime = now;
        return true;
    }
    return circuitBreakerState !== 'OPEN';
}

// Fallback response quando serviço está degradado
function fallbackResponse() {
    fallbacks.add(1);
    degradedRequests.add(1);
    console.log('⚠️ Executando fallback devido à falha');
    
    return {
        status: 200,
        body: JSON.stringify({
            success: true,
            message: 'Fallback response - serviço temporariamente indisponível',
            degraded: true,
            timestamp: new Date().toISOString()
        }),
        headers: { 'Content-Type': 'application/json' },
        timings: { duration: 100 } // Fallback rápido
    };
}

// Medição de throughput para detectar degradação
let requestCount = 0;
let lastThroughputCheck = Date.now();

function measureThroughput() {
    const now = Date.now();
    const elapsed = (now - lastThroughputCheck) / 1000;
    
    if (elapsed >= 10) { // Medir a cada 10 segundos
        currentThroughput = requestCount / elapsed;
        
        if (baselineThroughput === 0) {
            baselineThroughput = currentThroughput;
        } else {
            const degradation = ((baselineThroughput - currentThroughput) / baselineThroughput) * 100;
            if (degradation > 0) {
                throughputDegradation.add(degradation);
                console.log(`📉 Degradação do throughput: ${degradation.toFixed(1)}% (baseline: ${baselineThroughput.toFixed(1)}, atual: ${currentThroughput.toFixed(1)})`);
            }
        }
        
        requestCount = 0;
        lastThroughputCheck = now;
    }
}

export default function() {
    requestCount++;
    measureThroughput();
    
    // Verificar se circuit breaker permite requisição
    if (!canRetry()) {
        const fallback = fallbackResponse();
        check(fallback, {
            'fallback response': (r) => r.status === 200,
        });
        sleep(0.1); // Pequena pausa
        return;
    }
    
    // Injetar latência artificial se estivermos no período de problema
    const hasArtificialLatency = artificialLatency();
    
    const startTime = Date.now();
    
    try {
        // Fazer requisição REST
        const response = http.post('http://localhost:3000/api/process', 
            JSON.stringify({
                data: `resilience-test-${__VU}-${__ITER}`,
                timestamp: new Date().toISOString(),
                test_type: 'resilience'
            }), 
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: '30s'
            }
        );
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Verificar se a resposta indica sucesso
        const isSuccess = check(response, {
            'status is 200': (r) => r.status === 200,
            'response time < 30s': (r) => r.timings.duration < 30000,
            'response has success': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body && (body.success === true || body.status === 'success');
                } catch (e) {
                    return false;
                }
            },
        });
        
        // Detectar falhas e atualizar circuit breaker
        if (!isSuccess || response.status !== 200 || duration > 10000 || hasArtificialLatency) {
            errors.add(1);
            failureCount++;
            lastFailureTime = Date.now();
            
            console.log(`❌ Falha detectada - Status: ${response.status}, Duração: ${duration}ms, Latência artificial: ${hasArtificialLatency}`);
            
            if (shouldOpenCircuitBreaker()) {
                circuitBreakerState = 'OPEN';
                console.log('🔴 Circuit Breaker ABERTO');
            }
        } else {
            // Sucesso - resetar contador se estivermos em recuperação
            if (circuitBreakerState === 'HALF_OPEN') {
                circuitBreakerState = 'CLOSED';
                const recoveryDuration = Date.now() - recoveryStartTime;
                recoveryTime.add(recoveryDuration);
                console.log(`🟢 Circuit Breaker FECHADO - Recuperação em ${recoveryDuration}ms`);
                failureCount = 0; // Reset failure count
            }
        }
        
    } catch (error) {
        errors.add(1);
        failureCount++;
        lastFailureTime = Date.now();
        console.log(`💥 Erro de conexão: ${error.message}`);
        
        // Executar fallback em caso de erro de conexão
        const fallback = fallbackResponse();
        check(fallback, {
            'fallback executed': (r) => r.status === 200,
        });
        
        if (shouldOpenCircuitBreaker()) {
            circuitBreakerState = 'OPEN';
        }
    }
    
    // Pequena pausa entre requisições
    sleep(0.1);
}

export function setup() {
    console.log('🚀 Iniciando teste de resiliência REST');
    console.log('⚙️ Configuração: 500 VUs, Circuit Breaker ativo, Latência 2s entre 30-90s');
    
    // Armazenar tempo de início
    __ENV.TEST_START_TIME = Date.now();
    
    return { testStartTime: Date.now() };
}

export function teardown(data) {
    console.log('📊 Teste de Resiliência REST Finalizado');
    console.log(`⚡ Circuit Breaker Estado Final: ${circuitBreakerState}`);
    console.log(`💥 Total de Falhas: ${failureCount}`);
    console.log(`🔄 Throughput Baseline: ${baselineThroughput.toFixed(1)} req/s`);
    console.log(`📈 Throughput Final: ${currentThroughput.toFixed(1)} req/s`);
}
