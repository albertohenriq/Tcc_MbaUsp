#!/bin/bash
# Arquivo de entrada para iniciar tanto o servidor REST quanto o gRPC
import multiprocessing
import uvicorn
from app.grpc_server import serve as serve_grpc

def start_rest():
    uvicorn.run("app.main:app", host="0.0.0.0", port=3001, reload=False)

if __name__ == "__main__":
    # Iniciar servidor gRPC em um processo separado
    grpc_process = multiprocessing.Process(target=serve_grpc)
    grpc_process.start()
    
    # Iniciar servidor REST no processo principal
    start_rest()
