from fastapi import FastAPI, Request, Response
from app.grpc_server import serve as grpc_serve
import threading
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from concurrent import futures
import grpc
import time
import json
import structlog
import uuid
from typing import Dict, Any

# Configuração do logger
logger = structlog.get_logger()

# Configuração do FastAPI
app = FastAPI(title="Service B - Processing")

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Métricas Prometheus
REQUEST_COUNT = Counter(
    'request_count',
    'App Request Count',
    ['method', 'endpoint', 'http_status']
)

REQUEST_LATENCY = Histogram(
    'request_latency_seconds',
    'Request latency',
    ['method', 'endpoint']
)

# Simulação de processamento
def process_data(data: Dict[str, Any]) -> Dict[str, Any]:
    # Simula processamento
    time.sleep(0.1)
    
    processed_id = str(uuid.uuid4())
    return {
        "message": "Dados processados com sucesso",
        "success": True,
        "processedId": processed_id,
        "timestamp": int(time.time())
    }

# Endpoints REST
@app.post("/api/process")
async def process_rest(request: Request):
    start_time = time.time()
    
    try:
        data = await request.json()
        logger.info("rest_request_received", data=data)
        
        result = process_data(data)
        
        REQUEST_COUNT.labels(
            method='POST',
            endpoint='/api/process',
            http_status=200
        ).inc()
        
        REQUEST_LATENCY.labels(
            method='POST',
            endpoint='/api/process'
        ).observe(time.time() - start_time)
        
        logger.info("rest_request_processed", result=result)
        return result
        
    except Exception as e:
        logger.error("rest_request_error", error=str(e))
        REQUEST_COUNT.labels(
            method='POST',
            endpoint='/api/process',
            http_status=500
        ).inc()
        raise

@app.get("/metrics")
async def metrics():
    return Response(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

@app.get("/health")
async def health():
    return {"status": "ok"}

# Iniciar servidor gRPC em uma thread separada
grpc_server = grpc_serve()
logger.info("Servidor gRPC iniciado na porta 50052")
