#!/bin/sh
# updater.sh — descarga la última release y la despliega en el volumen compartido
set -e

REPO="Rubenav82/Mutation_Diff"
ASSET="mutadiff-latest.zip"
# Sobreescribibles por entorno para poder ejercitar el despliegue fuera del
# contenedor, contra un directorio cualquiera.
WEBROOT="${WEBROOT:-/app}"
# El nuevo contenido se prepara dentro del propio volumen para poder cambiarlo
# de sitio con un `mv` (misma partición) en vez de copiarlo sobre lo que nginx
# está sirviendo.
STAGE="${WEBROOT}/.new"
TMP_ZIP="${TMP_ZIP:-/tmp/mutadiff.zip}"

# Un `trap` y no un `rm` por rama: con `set -e` cualquier orden puede abortar el
# script (`unzip` sale con 1 hasta con un simple warning), así que limpiar en el
# camino del error deja fuera justo las vías que no se previeron.
cleanup() {
  rm -rf "$STAGE" "$TMP_ZIP"
}
trap cleanup EXIT

# Solo si falta: así reiniciar el updater no vuelve a salir a la red sin
# necesidad. Sin silenciar la salida — si el mirror de Alpine no es alcanzable,
# `set -e` aborta y el log tiene que decir por qué.
if ! command -v unzip > /dev/null 2>&1; then
  echo "[mutadiff] Instalando unzip..."
  apk add --no-cache unzip
fi

echo "[mutadiff] Consultando última release..."
URL=$(wget -T 30 -qO- "https://api.github.com/repos/${REPO}/releases/latest" |
  grep "browser_download_url" |
  grep "${ASSET}" |
  cut -d '"' -f 4)

# `set -e` no cubre esto: el código de salida de la tubería es el del `cut`, que
# termina bien aunque el `wget` haya fallado y no haya llegado nada.
if [ -z "$URL" ]; then
  echo "[mutadiff] ERROR: no se pudo obtener la URL de descarga de ${ASSET}"
  exit 1
fi

echo "[mutadiff] Descargando: ${URL}"
wget -T 30 -O "$TMP_ZIP" "$URL"

echo "[mutadiff] Descomprimiendo..."
rm -rf "$STAGE"
mkdir -p "$STAGE"
unzip -oq "$TMP_ZIP" -d "$STAGE"

# El zip lleva el contenido de `packages/web/dist` en su raíz. Si algún día deja
# de llevarlo, mejor fallar aquí que sustituir lo que funciona por un directorio
# que nginx no sabe servir.
if [ ! -f "${STAGE}/index.html" ]; then
  echo "[mutadiff] ERROR: el zip no contiene index.html en su raíz"
  exit 1
fi

# Se descarga y valida antes de tocar nada, así que un fallo de red o un zip
# inservible dejan intacta la versión que ya se estaba sirviendo. La sustitución
# en sí son dos renombrados: no es atómica —hacerlo del todo pediría un symlink
# y una config propia de nginx— pero la ventana es de milisegundos y nunca deja
# el sitio a medio escribir.
echo "[mutadiff] Desplegando en ${WEBROOT}..."
find "$WEBROOT" -mindepth 1 -maxdepth 1 ! -name '.new' -exec rm -rf {} \;
find "$STAGE" -mindepth 1 -maxdepth 1 -exec mv {} "$WEBROOT/" \;

echo "[mutadiff] Listo."
