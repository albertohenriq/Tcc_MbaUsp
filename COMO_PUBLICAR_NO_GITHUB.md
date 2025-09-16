# 📦 Como Publicar o Projeto no GitHub

Este guia garante que todo o seu trabalho (microsserviços, Docker, testes, dashboards e instruções) será versionado corretamente.

---

## 1. Estrutura Recomendada do Repositório

```
FinalTcc/
├── src/
│   ├── service-a-nodejs/
│   ├── service-b-python/
│   └── service-c-nodejs/
├── docker/
│   ├── grafana/
│   └── prometheus/
├── k6-tests/
├── docs/
├── dashboards/   # (opcional, pode ser um link para docker/grafana/dashboards)
├── docker-compose.yml
├── README.md
└── ...
```

---

## 2. Passos para Subir ao GitHub

### a) Inicialize o repositório (se ainda não existir)
```powershell
cd C:\Users\Alberto\Desktop\FinalTcc
# Se ainda não existir:
git init
```

### b) Crie um arquivo .gitignore
Inclua:
```
# Python
__pycache__/
*.pyc
.venv/
# Node
node_modules/
# Outros
*.log
*.env
*.sqlite
*.db
# Resultados grandes
*.png
*.json
monitoring-results/
```

### c) Adicione todos os arquivos relevantes
```powershell
git add src/ docker/ k6-tests/ docs/ docker-compose.yml README.md
# Se quiser incluir dashboards separadamente:
git add docker/grafana/dashboards/
```

### d) Commit inicial
```powershell
git commit -m "Implementação completa dos microsserviços, Docker, testes, dashboards e instruções"
```

### e) Crie o repositório no GitHub
- Acesse https://github.com/new
- Nomeie como `final-tcc` ou similar
- NÃO marque para criar README (você já tem)

### f) Vincule o repositório local ao remoto
```powershell
git remote add origin https://github.com/SEU_USUARIO/final-tcc.git
git branch -M main
git push -u origin main
```

---

## 3. Instruções para Reprodução dos Experimentos

Inclua no `README.md`:
- Como rodar os containers (docker-compose)
- Como executar os testes de carga (k6)
- Como acessar dashboards (Grafana)
- Como rodar scripts de análise
- Pré-requisitos (Docker, Node, Python, etc)

---

## 4. Dicas Finais
- Não suba arquivos de resultados brutos muito grandes (use .gitignore)
- Documente variáveis de ambiente e portas expostas
- Inclua exemplos de comandos de execução

---

Pronto! Seu projeto estará pronto para ser compartilhado e reproduzido por qualquer pessoa.
