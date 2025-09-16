<#
  Script PowerShell para executar testes de escalabilidade locais.
  Requisitos:
   - Docker Desktop com Compose v2 (comande: docker compose)
   - k6 disponível no PATH (ou usar k6.exe fornecido na raiz)

  O script fará os passos para cada cenário: 1,2,4,8 réplicas para service-b:
   - docker compose up --scale service-b=<N> -d --build
   - aguarda 15s para estabilizar
   - executa k6 com o script k6-tests/comparison/scale-service-b.js
   - salva resultados em ./k6-results/scale-<N>.json
   - coleta métricas simples do Prometheus (taxa de requests e uso de CPU via cadvisor)
#>

$scenarios = @(1,2,4,8)
$composeFile = "docker-compose.yml"
$k6Exe = "k6"  # Pode apontar para k6.exe na raiz se preferir: .\k6.exe

$newDir = Join-Path -Path (Get-Location) -ChildPath "k6-results"
if (!(Test-Path $newDir)) { New-Item -ItemType Directory -Path $newDir | Out-Null }

foreach ($n in $scenarios) {
    Write-Host "\n=== Cenário: service-b com $n réplica(s) ==="

    # Subir com escala
    Write-Host "Subindo serviços com escala..."
    docker compose -f $composeFile up --scale service-b=$n -d --build

    Write-Host "Aguardando 20s para estabilizar containers..."
    Start-Sleep -Seconds 20

    # Rodar k6
    $outFile = Join-Path $newDir "scale-$n.json"
    $logFile = Join-Path $newDir "scale-$n.txt"

    Write-Host "Executando k6 (isso pode demorar) ..."
    & $k6Exe run .\k6-tests\comparison\scale-service-b.js --out json=$outFile > $logFile

    Write-Host "k6 finalizado, resultados em: $outFile"

    # Coletar algumas métricas do Prometheus (via API) - consultas básicas
    $promUrl = 'http://localhost:9090'
    # consultas Prometheus (janela 1m)
    $range = '60s'

    $queryRequests = 'sum(rate(request_count[1m]))'
    $queryCpu = 'sum(container_cpu_usage_seconds_total)'

    try {
        $reqResp = Invoke-RestMethod -Uri "$promUrl/api/v1/query?query=$($queryRequests)" -Method Get
        $cpuResp = Invoke-RestMethod -Uri "$promUrl/api/v1/query?query=$($queryCpu)" -Method Get
        $summaryFile = Join-Path $newDir "scale-$n-prom-summary.json"
        @{requests=$reqResp; cpu=$cpuResp} | ConvertTo-Json | Out-File $summaryFile
        Write-Host "Resumo Prometheus salvo em $summaryFile"
    } catch {
        Write-Host "Falha ao coletar métricas Prometheus: $_"
    }

    Write-Host "Parando e removendo containers (manter volumes)..."
    docker compose -f $composeFile down
}

Write-Host "\nTodos os cenários executados. Resultados em .\k6-results\"
