# Buffalo Print Bridge Installer

Este directorio contiene el esqueleto del instalador del puente de impresion
para Windows.

## Objetivo

Dejar una PC lista para:

- ejecutar `print-server.js` al iniciar Windows
- exponer el bridge con `ngrok`
- detectar y guardar la URL publica activa del bridge

## Estructura

- `lib/bridge-env.ps1`: constantes compartidas y helpers de runtime
- `ensure-node.ps1`: asegura Node.js LTS antes de instalar el bridge
- `templates/ngrok.yml`: plantilla base de configuracion del agente `ngrok`
- `templates/install-manifest.json`: manifiesto editable durante el empaquetado
- `start-bridge.ps1`: inicia PrintServer + ngrok
- `stop-bridge.ps1`: detiene procesos del bridge
- `status-bridge.ps1`: informa estado local y host publico detectado
- `install-bridge.ps1`: copia runtime y registra inicio automatico
- `uninstall-bridge.ps1`: quita tarea programada y elimina la instalacion
- `..\instalar.bat`: entrypoint recomendado para el cliente final
- `..\estado-bridge.bat`: muestra estado del bridge
- `..\desinstalar-bridge.bat`: desinstala el bridge

## Notas

- Este bundle sigue pensado para un uso interno, con una sola PC activa.
- `publicHost` ya queda apuntando al dominio asignado `jannie-unchiselled-eladia.ngrok-free.dev`.
- Si alguna vez cambia el token o el dominio de `ngrok`, hay que actualizar el manifest y la plantilla.
- `instalar.bat` descarga e instala Node.js 20.20.2 desde `nodejs.org` si la PC no tiene una version valida.
