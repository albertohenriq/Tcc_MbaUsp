const express = require('express');
const cors = require('cors');
const prometheus = require('prom-client');
const winston = require('winston');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'service-c.log' })
  ]
});

// Configuração do SQLite
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    logger.error('Erro ao conectar ao SQLite', { error: err });
    return;
  }
  logger.info('Conectado ao SQLite');
  
  // Criar tabela
  db.run(`CREATE TABLE IF NOT EXISTS processed_data (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )`);
});

// Métricas Prometheus
const register = new prometheus.Registry();
prometheus.collectDefaultMetrics({ register });

const storageOperationDuration = new prometheus.Histogram({
  name: 'storage_operation_duration_seconds',
  help: 'Duração das operações de armazenamento em segundos',
  labelNames: ['operation', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

register.registerMetric(storageOperationDuration);

// Configuração Express
const app = express();
app.use(cors());
app.use(express.json());

// Endpoint de métricas
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Endpoint REST para armazenamento
app.post('/api/store', (req, res) => {
  const startTime = process.hrtime();
  
  const { processedId, data } = req.body;
  const timestamp = Date.now();
  
  db.run(
    'INSERT INTO processed_data (id, data, timestamp) VALUES (?, ?, ?)',
    [processedId, JSON.stringify(data), timestamp],
    (err) => {
      const duration = process.hrtime(startTime);
      const durationSeconds = duration[0] + duration[1] / 1e9;
      
      if (err) {
        logger.error('Erro ao armazenar dados', { error: err });
        storageOperationDuration
          .labels('insert', 'error')
          .observe(durationSeconds);
        res.status(500).json({ error: 'Erro ao armazenar dados' });
        return;
      }
      
      storageOperationDuration
        .labels('insert', 'success')
        .observe(durationSeconds);
      
      logger.info('Dados armazenados com sucesso', { processedId });
      res.json({ success: true, processedId });
    }
  );
});

// Configuração gRPC
const PROTO_PATH = path.resolve(__dirname, '../proto/storage.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const storageProto = grpc.loadPackageDefinition(packageDefinition).storage;

// Implementação do servidor gRPC
const server = new grpc.Server();
server.addService(storageProto.StorageService.service, {
  StoreData: (call, callback) => {
    const startTime = process.hrtime();
    const { processedId, data } = call.request;
    const timestamp = Date.now();
    
    db.run(
      'INSERT INTO processed_data (id, data, timestamp) VALUES (?, ?, ?)',
      [processedId, JSON.stringify(data), timestamp],
      (err) => {
        const duration = process.hrtime(startTime);
        const durationSeconds = duration[0] + duration[1] / 1e9;
        
        if (err) {
          logger.error('Erro ao armazenar dados via gRPC', { error: err });
          storageOperationDuration
            .labels('insert_grpc', 'error')
            .observe(durationSeconds);
          callback(err);
          return;
        }
        
        storageOperationDuration
          .labels('insert_grpc', 'success')
          .observe(durationSeconds);
        
        logger.info('Dados armazenados com sucesso via gRPC', { processedId });
        callback(null, { success: true, processedId });
      }
    );
  }
});

// Inicialização dos servidores
const PORT = 3002;
const GRPC_PORT = 50053;

app.listen(PORT, () => {
  logger.info(`Servidor REST rodando na porta ${PORT}`);
});

server.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (error, port) => {
    if (error) {
      logger.error('Erro ao iniciar servidor gRPC', { error });
      return;
    }
    server.start();
    logger.info(`Servidor gRPC rodando na porta ${port}`);
  }
);
