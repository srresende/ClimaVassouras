#!/usr/bin/env bash
# Coleta e faz commit + push do CSV, só se ele mudou. Usado pelo GitHub Actions.
# Se o push for recusado (o PC publicou antes), volta ao remoto e coleta de novo:
# o script de coleta é idempotente, então refazer é seguro.
set -euo pipefail

CSV="dados/clima_vassouras.csv"

for tentativa in 1 2 3; do
  python coleta/coletar.py

  git add "$CSV"
  if git diff --cached --quiet; then
    echo "Sem alterações no CSV: nada a publicar."
    exit 0
  fi

  git commit -q -m "Dados de $(TZ=America/Sao_Paulo date +%F)"
  if git push -q origin HEAD:main; then
    echo "CSV publicado."
    exit 0
  fi

  echo "Push recusado (tentativa $tentativa); atualizando e coletando de novo."
  git fetch -q origin main
  git reset -q --hard origin/main
done

echo "ERRO: não foi possível publicar o CSV após 3 tentativas."
exit 1
