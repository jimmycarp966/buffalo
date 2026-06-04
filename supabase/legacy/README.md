# Scripts legacy (NO ejecutar)

Estos `.sql` son scripts sueltos / one-off historicos que quedaron del desarrollo
previo. **No los ejecutes.** Se conservan solo como referencia.

La unica fuente de verdad para inicializar la base de datos es:

    ../BUFFALO_SETUP.sql

Cualquier cambio de esquema, funciones, RLS o datos semilla debe hacerse alli.
Si necesitas algo de estos scripts, portalo a `BUFFALO_SETUP.sql` de forma
idempotente en lugar de correr el script suelto.
