#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

if ! command -v node >/dev/null 2>&1; then
  echo "No se encontró Node.js. Instala Node.js 20 LTS o superior."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js está instalado, pero npm no está disponible en PATH."
  exit 1
fi

exec node scripts/iniciar-local.js
