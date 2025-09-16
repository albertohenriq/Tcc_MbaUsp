# Script PowerShell Simplificado para Coleta de Dados
param(
    [int]$Duration = 180,
    [int]$VirtualUsers = 300
)

Write-Host "INICIANDO COLETA COMPLETA DE DADOS" -ForegroundColor Green
Write-Host "Duration: $Duration segundos, Users: $VirtualUsers" -ForegroundColor Cyan

# Criar diretórios
$ResultsDir = "monitoring-results"
if (!(Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir -Force
}

Write-Host "Parando containers existentes..." -ForegroundColor Yellow
docker-compose down --remove-orphans

Write-Host "Iniciando stack completa..." -ForegroundColor Yellow
docker-compose up -d --build

Write-Host "Aguardando inicializacao (45s)..." -ForegroundColor Yellow
Start-Sleep 45

# Verificar serviços
Write-Host "Verificando servicos..." -ForegroundColor Cyan
$services = @(
    "http://localhost:3000/health",
    "http://localhost:9090",
    "http://localhost:3010"
)

foreach ($url in $services) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10
        Write-Host "$url - OK" -ForegroundColor Green
    } catch {
        Write-Host "$url - ERRO" -ForegroundColor Red
    }
}

# Executar teste REST
Write-Host "Executando teste REST..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$restFile = "$ResultsDir\rest_monitoring_$timestamp.json"

& .\k6.exe run --out json=$restFile k6-tests\monitoring-collection-test.js --env PROTOCOL=rest

if ($LASTEXITCODE -eq 0) {
    Write-Host "Teste REST concluido" -ForegroundColor Green
} else {
    Write-Host "Erro no teste REST" -ForegroundColor Red
}

Start-Sleep 30

# Executar teste gRPC  
Write-Host "Executando teste gRPC..." -ForegroundColor Yellow
$grpcFile = "$ResultsDir\grpc_monitoring_$timestamp.json"

& .\k6.exe run --out json=$grpcFile k6-tests\monitoring-collection-test.js --env PROTOCOL=grpc

if ($LASTEXITCODE -eq 0) {
    Write-Host "Teste gRPC concluido" -ForegroundColor Green
} else {
    Write-Host "Erro no teste gRPC" -ForegroundColor Red
}

# Análise de logs
Write-Host "Executando analise..." -ForegroundColor Yellow
& .\.venv\Scripts\python.exe analyze_k6_logs.py

# Abrir Grafana
Write-Host "Abrindo Grafana..." -ForegroundColor Cyan
Start-Process "http://localhost:3010"

Write-Host ""
Write-Host "COLETA CONCLUIDA!" -ForegroundColor Green
Write-Host "Grafana: http://localhost:3010 (admin/admin)" -ForegroundColor Cyan
Write-Host "Prometheus: http://localhost:9090" -ForegroundColor Cyan
Write-Host "Resultados em: $ResultsDir" -ForegroundColor Cyan
