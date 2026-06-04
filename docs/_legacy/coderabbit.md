# Integración de CodeRabbit

> Referencia oficial: [CodeRabbit Configuration](https://coderabbit.mintlify.app/getting-started/configure-coderabbit) y [GitHub Marketplace](https://github.com/marketplace/coderabbitai).

## Instalación en GitHub

1. Abrí la página de CodeRabbit en GitHub Marketplace y presioná **Install**.
2. Elegí la organización o cuenta personal que contiene `jimmycarp966/almendra`.
3. Autorizá los permisos solicitados y seleccioná este repositorio (o **All repositories** si preferís).
4. Confirmá con **Install & Authorize**. A partir de ese momento, CodeRabbit revisa los PR nuevos.

## Configuración del repositorio

- El archivo `.coderabbit.yaml` en la raíz define idioma, tono y reglas específicas para este proyecto.
- Cualquier ajuste adicional se realiza editando ese archivo y creando un PR; CodeRabbit solo respeta configuraciones presentes en la rama del PR.
- Para inspeccionar o exportar la configuración activa desde un PR existente, comentá `@coderabbitai configuration`.

## Buenas prácticas

- Creá tus PR con títulos descriptivos; el bot ignora títulos con `wip` o `draft`.
- Añadí contexto en la descripción para mejorar la calidad del resumen generado.
- Si necesitás pausar CodeRabbit en un PR puntual, convertí el PR a *draft* o agregá `wip` en el título.

## Verificación rápida

- Abrí un PR nuevo o actualizá uno existente. Debería aparecer el check `CodeRabbit Review`.
- Alternativamente, comentá `@coderabbitai summary` o `@coderabbitai configuration` dentro del PR y verificá que responda.
- Si el bot no aparece, revisá los permisos en `Settings → Integrations → GitHub Apps → CodeRabbit`.

