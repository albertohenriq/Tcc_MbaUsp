# Teste de Resiliência REST vs gRPC
# Cenário: Interrupção controlada do Serviço B durante carga de 500 usuários
# Comparação: REST vs gRPC com falhas simuladas

param(
    [int]$Duration = 90,           # Duração do teste (90s para incluir recuperação)
    [int]$VUs = 500,               # 500 usuários virtuais
    [int]$FailureTime = 30,        # Momento da falha (30s após início)
    [int]$RecoveryTime = 60,       # Momento da recuperação (60s após início)
    [int]$LatencyDelay = 2000      # Latência artificial 2s
)

$ErrorActionPreference = "Continue"

Write-Host "🔥 TESTE DE RESILIÊNCIA REST vs gRPC" -ForegroundColor Cyan
Write-Host "=" * 75 -ForegroundColor Cyan
Write-Host "⚙️  Configuração:" -ForegroundColor Yellow
Write-Host "   • Duração: ${Duration}s" -ForegroundColor White
Write-Host "   • Usuários: ${VUs} VUs" -ForegroundColor White
Write-Host "   • Falha em: ${FailureTime}s" -ForegroundColor White
Write-Host "   • Recuperação em: ${RecoveryTime}s" -ForegroundColor White
Write-Host "   • Latência injetada: ${LatencyDelay}ms" -ForegroundColor White
Write-Host ""

# Criar diretório de resultados
$ResultsDir = "k6-results-resilience"
if (Test-Path $ResultsDir) {
    Remove-Item $ResultsDir -Recurse -Force
}
New-Item -ItemType Directory -Path $ResultsDir | Out-Null
Write-Host "📁 Criado diretório: $ResultsDir" -ForegroundColor Green

# Função para simular falha no container
function Simulate-ContainerFailure {
    param([string]$Protocol, [int]$DelaySeconds)
    
    Start-Sleep -Seconds $DelaySeconds
    Write-Host "💥 [${Protocol}] Simulando falha: Parando service-b..." -ForegroundColor Red
    docker-compose stop service-b | Out-Null
    return (Get-Date)
}

# Função para simular recuperação
function Simulate-Recovery {
    param([string]$Protocol, [int]$DelaySeconds)
    
    Start-Sleep -Seconds $DelaySeconds
    Write-Host "🔄 [${Protocol}] Iniciando recuperação: Reiniciando service-b..." -ForegroundColor Yellow
    docker-compose up -d service-b | Out-Null
    Start-Sleep -Seconds 15  # Aguardar estabilização
    Write-Host "✅ [${Protocol}] Service-b recuperado!" -ForegroundColor Green
    return (Get-Date)
}

# Função para executar teste com falhas
function Run-ResilienceTest {
    param(
        [string]$Protocol,
        [string]$TestScript,
        [string]$OutputFile
    )
    
    Write-Host ""
    Write-Host "🧪 TESTE DE RESILIÊNCIA - ${Protocol}" -ForegroundColor Magenta
    Write-Host "-" * 50 -ForegroundColor Magenta
    
    # Limpar ambiente
    Write-Host "🧹 Limpando ambiente..." -ForegroundColor Gray
    docker-compose down | Out-Null
    Start-Sleep -Seconds 5
    
    # Iniciar serviços
    Write-Host "🚀 Iniciando serviços..." -ForegroundColor Gray
    docker-compose up -d | Out-Null
    Start-Sleep -Seconds 20
    
    # Verificar conectividade
    Write-Host "🔍 Verificando conectividade..." -ForegroundColor Gray
    $MaxRetries = 10
    $RetryCount = 0
    $Connected = $false
    
    while ($RetryCount -lt $MaxRetries -and -not $Connected) {
        try {
            if ($Protocol -eq "REST") {
                $Response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
                if ($Response.StatusCode -eq 200) { $Connected = $true }
            } else {
                # Para gRPC, verificamos se a porta está aberta
                $TcpTest = Test-NetConnection -ComputerName localhost -Port 50051 -InformationLevel Quiet -WarningAction SilentlyContinue
                if ($TcpTest) { $Connected = $true }
            }
        } catch {
            # Ignorar erro e tentar novamente
        }
        
        if (-not $Connected) {
            Start-Sleep -Seconds 3
            $RetryCount++
            Write-Host "   Tentativa $($RetryCount)/$($MaxRetries)..." -ForegroundColor Gray
        }
    }
    
    if (-not $Connected) {
        Write-Host "❌ Falha na conectividade ${Protocol}!" -ForegroundColor Red
        return $false
    }
    
    Write-Host "✅ Conectividade ${Protocol} confirmada!" -ForegroundColor Green
    
    # Preparar jobs para falha e recuperação
    $FailureJob = Start-Job -ScriptBlock {
        param($Protocol, $DelaySeconds)
        Start-Sleep -Seconds $DelaySeconds
        $FailureTime = Get-Date
        docker-compose stop service-b | Out-Null
        return @{
            Protocol = $Protocol
            FailureTime = $FailureTime
            Message = "Container service-b parado"
        }
    } -ArgumentList $Protocol, $FailureTime
    
    $RecoveryJob = Start-Job -ScriptBlock {
        param($Protocol, $DelaySeconds)
        Start-Sleep -Seconds $DelaySeconds
        $RecoveryTime = Get-Date
        docker-compose up -d service-b | Out-Null
        Start-Sleep -Seconds 15  # Aguardar estabilização
        return @{
            Protocol = $Protocol
            RecoveryTime = $RecoveryTime
            Message = "Container service-b recuperado"
        }
    } -ArgumentList $Protocol, $RecoveryTime
    
    # Executar teste k6 com monitoramento
    Write-Host "⚡ Executando teste k6 com ${VUs} usuários..." -ForegroundColor Cyan
    Write-Host "   📊 Arquivo de saída: ${OutputFile}" -ForegroundColor Gray
    Write-Host "   ⏱️  Duração: ${Duration}s" -ForegroundColor Gray
    Write-Host "   💥 Falha programada: ${FailureTime}s" -ForegroundColor Gray
    Write-Host "   🔄 Recuperação: ${RecoveryTime}s" -ForegroundColor Gray
    
    $TestStartTime = Get-Date
    $k6Command = ".\k6.exe run --vus $VUs --duration ${Duration}s --out json=${ResultsDir}\${OutputFile}.json $TestScript"
    
    try {
        # Executar k6 e capturar saída
        $k6Output = Invoke-Expression $k6Command 2>&1
        $k6Output | Out-File -FilePath "$ResultsDir\${OutputFile}-console.txt" -Encoding UTF8
        
        # Aguardar conclusão dos jobs
        $FailureResult = Receive-Job -Job $FailureJob -Wait
        $RecoveryResult = Receive-Job -Job $RecoveryJob -Wait
        
        # Limpar jobs
        Remove-Job -Job $FailureJob -Force
        Remove-Job -Job $RecoveryJob -Force
        
        $TestEndTime = Get-Date
        
        Write-Host "✅ Teste ${Protocol} concluído!" -ForegroundColor Green
        Write-Host "   💥 Falha simulada: $($FailureResult.FailureTime)" -ForegroundColor Red
        Write-Host "   🔄 Recuperação: $($RecoveryResult.RecoveryTime)" -ForegroundColor Yellow
        Write-Host "   ⏱️  Duração total: $((${TestEndTime} - ${TestStartTime}).TotalSeconds)s" -ForegroundColor Gray
        
        return $true
        
    } catch {
        Write-Host "❌ Erro no teste ${Protocol}: $_" -ForegroundColor Red
        return $false
    }
}

# Executar testes de resiliência
Write-Host "🎯 Iniciando bateria de testes de resiliência..." -ForegroundColor Cyan
Write-Host ""

# Teste 1: REST com falhas
$RestSuccess = Run-ResilienceTest -Protocol "REST" -TestScript "k6-tests\resilience-rest-test.js" -OutputFile "rest-resilience"

Start-Sleep -Seconds 10

# Teste 2: gRPC com falhas  
$GrpcSuccess = Run-ResilienceTest -Protocol "gRPC" -TestScript "k6-tests\resilience-grpc-test.js" -OutputFile "grpc-resilience"

# Limpeza final
Write-Host ""
Write-Host "🧹 Limpeza final..." -ForegroundColor Gray
docker-compose down | Out-Null

# Resumo final
Write-Host ""
Write-Host "📋 RESUMO DOS TESTES DE RESILIÊNCIA" -ForegroundColor Cyan
Write-Host "=" * 75 -ForegroundColor Cyan
Write-Host "🚀 REST:  $(if ($RestSuccess) { "✅ SUCESSO" } else { "❌ FALHA" })" -ForegroundColor $(if ($RestSuccess) { "Green" } else { "Red" })
Write-Host "⚡ gRPC:  $(if ($GrpcSuccess) { "✅ SUCESSO" } else { "❌ FALHA" })" -ForegroundColor $(if ($GrpcSuccess) { "Green" } else { "Red" })
Write-Host ""
Write-Host "📁 Resultados salvos em: $ResultsDir" -ForegroundColor Yellow
Write-Host "🔍 Execute a análise: python scripts\analyze_resilience_results.py" -ForegroundColor Yellow
Write-Host ""

if ($RestSuccess -and $GrpcSuccess) {
    Write-Host "🎉 TODOS OS TESTES DE RESILIÊNCIA CONCLUÍDOS COM SUCESSO!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Alguns testes falharam. Verifique os logs para detalhes." -ForegroundColor Yellow
}

Write-Host "=" * 75 -ForegroundColor Cyan
