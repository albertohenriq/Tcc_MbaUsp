const express = require('express');
const cors = require('cors');
const prometheus = require('prom-client');
const winston = require('winston');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
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
    new winston.transports.File({ filename: 'service-a.log' })
  ]
});

// Métricas Prometheus
const register = new prometheus.Registry();
prometheus.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const grpcRequestDurationMicroseconds = new prometheus.Histogram({
  name: 'grpc_request_duration_seconds',
  help: 'Duration of gRPC requests in seconds',
  labelNames: ['method', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(grpcRequestDurationMicroseconds);

// Configuração Express (REST)
const app = express();
app.use(cors());
app.use(express.json());

// Configuração gRPC
const PROTO_PATH = path.resolve(__dirname, '../proto/processing.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const processingProto = grpc.loadPackageDefinition(packageDefinition).processing;
const serviceB = new processingProto.ProcessingService(
  'service-b:50052',
  grpc.credentials.createInsecure()
);

// Middleware para métricas HTTP
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDurationMicroseconds
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration / 1000);
  });
  next();
});

// Endpoint de métricas
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Endpoint REST para processamento
app.post('/api/process', async (req, res) => {
  const startTime = Date.now();
  try {
    logger.info('Recebida requisição REST', { payload: req.body });

    // Chamada gRPC para o Serviço B
    serviceB.ProcessData(req.body, (error, response) => {
      if (error) {
        logger.error('Erro na chamada gRPC', { error });
        res.status(500).json({ error: 'Erro no processamento' });
        return;
      }

      logger.info('Resposta do Serviço B recebida', { response });
      res.json(response);
    });
  } catch (error) {
    logger.error('Erro no endpoint REST', { error });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para simular gRPC via HTTP (para comparação de protocolos)
app.post('/grpc/process', async (req, res) => {
  const startTime = Date.now();
  try {
    logger.info('Recebida requisição gRPC-HTTP', { payload: req.body });

    // Mesma lógica do REST mas com overhead simulado de gRPC
    serviceB.ProcessData(req.body, (error, response) => {
      if (error) {
        logger.error('Erro na chamada gRPC-HTTP', { error });
        res.status(500).json({ error: 'Erro no processamento gRPC' });
        return;
      }

      // Adicionar headers específicos do gRPC
      res.set({
        'content-type': 'application/grpc+json',
        'grpc-status': '0',
        'grpc-message': 'OK'
      });

      logger.info('Resposta gRPC-HTTP enviada', { response });
      res.json({
        ...response,
        protocol: 'grpc-http',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    logger.error('Erro no endpoint gRPC-HTTP', { error });
    res.status(500).json({ error: 'Erro interno do servidor gRPC' });
  }
});

// Servidor gRPC
const server = new grpc.Server();
server.addService(processingProto.ProcessingService.service, {
  ProcessData: (call, callback) => {
    const startTime = Date.now();
    logger.info('Recebida requisição gRPC', { payload: call.request });

    try {
      // Encaminha para o Serviço B
      serviceB.ProcessData(call.request, (error, response) => {
        const duration = (Date.now() - startTime) / 1000;
        grpcRequestDurationMicroseconds
          .labels('ProcessData', error ? 'ERROR' : 'SUCCESS')
          .observe(duration);

        if (error) {
          logger.error('Erro no processamento gRPC', { error });
          callback(error);
          return;
        }

        logger.info('Resposta gRPC enviada', { response });
        callback(null, response);
      });
    } catch (error) {
      logger.error('Erro no serviço gRPC', { error });
      callback(error);
    }
  }
});

// Inicialização dos servidores
const PORT = 3000;
const GRPC_PORT = 50051;

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
