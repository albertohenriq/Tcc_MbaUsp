// Teste de Resiliência REST
// Simulação de falhas com circuit breaker pattern
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Métricas customizadas para resiliência
const errorRate = new Rate('errors');
const fallbackRate = new Rate('fallbacks');
const recoveryTime = new Trend('recovery_time');
const throughputDegraded = new Counter('throughput_degraded');

// Circuit Breaker state
let circuitBreakerOpen = false;
let failureCount = 0;
let lastFailureTime = 0;
const FAILURE_THRESHOLD = 5;  // 50% de erros em 10 requests
const RECOVERY_TIMEOUT = 5000; // 5s para retry

export let options = {
    vus: 500,
    duration: '90s',
    thresholds: {
        'http_req_duration': ['p(95)<5000'], // Relaxado para falhas
        'errors': ['rate<0.7'], // Permitir até 70% de erro durante falhas
        'fallbacks': ['rate<0.8'], // Monitorar fallbacks
    },
};

// Função de fallback para degradação graceful
function fallbackResponse() {
    fallbackRate.add(1);
    throughputDegraded.add(1);
    return {
        status: 'degraded',
        message: 'Service temporarily unavailable - using fallback',
        timestamp: new Date().toISOString(),
        data: 'cached_or_default_response'
    };
}

// Circuit Breaker logic
function isCircuitBreakerOpen() {
    const now = Date.now();
    
    // Se o circuit breaker está aberto, verificar se é hora de tentar novamente
    if (circuitBreakerOpen) {
        if (now - lastFailureTime > RECOVERY_TIMEOUT) {
            console.log('🔄 Circuit Breaker: Tentando recuperação...');
            circuitBreakerOpen = false;
            failureCount = 0;
            return false;
        }
        return true;
    }
    
    return false;
}

function recordFailure() {
    failureCount++;
    lastFailureTime = Date.now();
    
    if (failureCount >= FAILURE_THRESHOLD) {
        console.log('💥 Circuit Breaker: ABERTO - Muitas falhas detectadas');
        circuitBreakerOpen = true;
    }
}

function recordSuccess() {
    if (circuitBreakerOpen) {
        console.log('✅ Circuit Breaker: FECHADO - Serviço recuperado');
        const recoveryTimeMs = Date.now() - lastFailureTime;
        recoveryTime.add(recoveryTimeMs);
    }
    
    failureCount = 0;
    circuitBreakerOpen = false;
}

export default function () {
    // Verificar Circuit Breaker
    if (isCircuitBreakerOpen()) {
        console.log('⚠️  Circuit Breaker ABERTO - Usando fallback');
        const fallback = fallbackResponse();
        errorRate.add(0); // Não é erro técnico, é fallback
        sleep(0.1); // Simular processamento mínimo
        return;
    }

    const payload = JSON.stringify({
        message: `Teste de resiliência - ${Date.now()}`,
        data: Array(100).fill('x').join(''), // Payload médio
        timestamp: new Date().toISOString(),
        userId: `user_${Math.floor(Math.random() * 1000)}`,
        requestId: `req_${Math.floor(Math.random() * 100000)}`
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: '10s', // Timeout maior para resiliência
    };

    const startTime = Date.now();

    try {
        const response = http.post('http://localhost:3000/api/process', payload, params);
        
        const isSuccess = check(response, {
            'status is 200': (r) => r.status === 200,
            'response time < 10s': (r) => r.timings.duration < 10000,
            'response has success': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body && (body.success === true || body.status === 'success');
                } catch (e) {
                    return false;
                }
            },
        });

        if (isSuccess) {
            recordSuccess();
            errorRate.add(0);
        } else {
            recordFailure();
            errorRate.add(1);
            console.log(`❌ Falha detectada: Status ${response.status}, Tempo: ${response.timings.duration}ms`);
        }

    } catch (error) {
        recordFailure();
        errorRate.add(1);
        console.log(`💥 Exceção capturada: ${error.message}`);
        
        // Em caso de erro, usar fallback
        const fallback = fallbackResponse();
    }

    // Simular think time variável baseado na carga
    const thinkTime = Math.random() * 0.5 + 0.1; // 0.1s a 0.6s
    sleep(thinkTime);
}

export function teardown(data) {
    console.log('📊 Teste de Resiliência REST Finalizado');
    console.log(`⚡ Circuit Breaker Estado Final: ${circuitBreakerOpen ? 'ABERTO' : 'FECHADO'}`);
    console.log(`💥 Total de Falhas: ${failureCount}`);
}
