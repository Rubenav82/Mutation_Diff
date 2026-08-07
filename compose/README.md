# Despliegue con Docker Compose

Stack para servir [Mutator Assessment Report](https://github.com/Rubenav82/Mutation_Diff) en una máquina interna, manteniéndolo al día automáticamente.

La aplicación se distribuye como ficheros estáticos. Este stack **no la construye**: descarga el zip de la última release de GitHub y lo sirve con nginx. Es la versión automatizada del `curl` + `unzip` + servidor de ficheros que describe el [README principal](../README.md#usarlo).

> **Necesita salida a internet** desde la máquina que sirve la aplicación: a `api.github.com` para consultar la release y al mirror de Alpine para instalar `unzip`. Si la máquina está aislada, `MutaDiff_Updater` falla y `MutaDiff_Web` no arranca (depende de que el updater termine con éxito). En ese caso, descarga el zip donde sí tengas red y descomprímelo a mano en el volumen, o sirve la carpeta sin Docker.

## Estructura

```
compose/
├── compose.yaml   # Stack Docker Compose
└── updater.sh     # Script de descarga y despliegue
```

## Servicios

| Contenedor         | Imagen         | Función                                            |
| ------------------ | -------------- | -------------------------------------------------- |
| `MutaDiff_Updater` | `alpine:latest` | Descarga la última release en el volumen compartido |
| `MutaDiff_Web`     | `nginx:alpine` | Sirve los ficheros estáticos                       |

El volumen compartido `mutadiff_app_content` persiste el contenido entre reinicios del servidor web, así que un reinicio de la máquina no obliga a volver a descargar nada.

## Primer arranque

```bash
docker compose up -d
```

`MutaDiff_Updater` se ejecuta primero, descarga el zip y lo despliega en el volumen. `MutaDiff_Web` arranca cuando el updater termina con éxito.

La aplicación queda disponible en `http://localhost:8080`.

## Actualizar a la última release

Reiniciar el contenedor `MutaDiff_Updater` (el servidor web no se interrumpe):

```bash
docker compose start updater
```

O desde cualquier herramienta de gestión de contenedores, iniciando el contenedor `MutaDiff_Updater`.

nginx sirve los ficheros directamente desde disco, por lo que los cambios en el volumen son efectivos de inmediato sin reiniciar el servidor web.

El updater descarga y valida el zip **antes** de tocar el contenido que se está sirviendo: si falla la red o el zip no trae un `index.html` en su raíz, aborta y deja intacta la versión anterior.

## Adaptación a un servidor remoto

Normalmente basta con el puerto externo:

```yaml
ports:
  - '8081:80' # Puerto externo según el servidor
```

No hace falta configurar nada más en nginx. En particular, **no hay que tocar `client_max_body_size`**: la aplicación corre entera en el navegador y no sube los reportes a ningún sitio, así que este servidor no recibe ningún cuerpo de petición — solo entrega ficheros.

Tampoco hace falta ninguna regla de reescritura hacia `index.html`: las rutas de la aplicación van en el hash y los assets son relativos, así que funciona igual en la raíz que colgando de un subpath.

## Fijar versiones de las imágenes

Las imágenes van sin fijar (`alpine:latest`, `nginx:alpine`) porque el updater solo necesita `wget` y `unzip`, y nginx solo servir ficheros: la superficie de rotura es mínima. Si el entorno exige reproducibilidad, sustitúyelas por una etiqueta o un digest concretos.
