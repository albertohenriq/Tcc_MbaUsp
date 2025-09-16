FROM python:3.11-slim

WORKDIR /app

# Copiar requirements primeiro para aproveitar cache do Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o resto do código
COPY . .

# Criar diretório para arquivos gerados
RUN mkdir -p ./app/generated

# Gerar código gRPC
RUN python -m grpc_tools.protoc -I./proto --python_out=./app/generated --grpc_python_out=./app/generated ./proto/processing.proto && \
    touch ./app/generated/__init__.py && \
    cd ./app/generated && \
    sed -i 's/import processing_pb2/from . import processing_pb2/' processing_pb2_grpc.py

# Expor portas (REST e gRPC)
EXPOSE 3001
EXPOSE 50052

# Comando para iniciar ambos os servidores
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
