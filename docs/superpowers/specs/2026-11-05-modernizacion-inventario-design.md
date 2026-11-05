# Diseño: modernización incremental de Inventario Rápido

## Intención

Entregar una copia independiente y verificable del sistema de inventario, conservando las funcionalidades existentes y modernizando la persistencia, la validación, la documentación, las pruebas y el despliegue. El motivo principal es reducir el riesgo de una reescritura: la aplicación ya contiene reglas de negocio y flujos operativos que deben seguir funcionando.

## Objetivos

- Mantener todos los módulos y rutas existentes.
- Migrar Prisma a Drizzle sobre PostgreSQL sin cambios destructivos.
- Centralizar validación con Zod, errores y logging estructurado.
- Formalizar el contrato REST/OpenAPI.
- Aumentar cobertura unitaria, integración, seguridad y E2E.
- Proporcionar Docker Compose reproducible con health checks y respaldo/restauración documentados.
- Registrar evidencia real de cada verificación.

## No objetivos

- No cambiar el modelo funcional ni eliminar módulos.
- No copiar datos reales, uploads, secretos, `node_modules` ni artefactos `dist`.
- No ejecutar migraciones contra la base de producción/original.
- No introducir microservicios ni dependencias sin una necesidad comprobada.

## Antipatrones evitados

- No se declarará éxito por una compilación aislada.
- No se sustituirán pruebas de integración por mocks.
- No se usará `db push --accept-data-loss` en el despliegue.
- No se modificarán ni resetearán archivos del proyecto original.

## Enfoques considerados

1. **Reescritura completa:** descartada por el riesgo de regresiones y pérdida de reglas implícitas.
2. **Migración incremental en copia:** seleccionada; permite equivalencia por módulo y rollback local.
3. **Modernización mínima manteniendo Prisma:** descartada porque no cumple la migración solicitada a Drizzle.

## Diseño aprobado

### Fases

1. Línea base: inventario, compilación, pruebas actuales y documentación.
2. Persistencia: traducir el esquema Prisma a Drizzle, crear migraciones reproducibles y adaptar el acceso a datos.
3. Backend: introducir Zod, errores centralizados, OpenAPI y migrar rutas por dominios.
4. Frontend: conservar Vue 3 y mejorar tipado, validaciones, errores y componentes sin cambiar los flujos.
5. Calidad: integración real con PostgreSQL aislado, E2E Playwright, seguridad, dependencias y concurrencia relevante.
6. Operación: Docker, health checks, backups, restauración y documentación final.

### Decisiones técnicas

- Se mantiene Vue 3/Vite/Tailwind porque ya son compatibles con el sistema y cambiar el frontend completo no aporta valor proporcional.
- Se mantiene Fastify porque ya soporta los plugins de seguridad, multipart, compresión y rate limiting usados.
- Drizzle será la única capa ORM final; Prisma permanecerá solo durante la transición y será retirado tras la verificación de equivalencia.
- PostgreSQL seguirá siendo la base objetivo; las pruebas usarán una instancia/volumen aislado.
- Las operaciones críticas de inventario y cierre de pedidos usarán transacciones explícitas.
- Las migraciones serán versionadas y ejecutables con Drizzle Kit.

## Criterio de finalización

Solo se marcará completado si la copia compila, la batería automatizada requerida pasa, los flujos E2E principales pasan, Docker arranca con health checks, las migraciones se prueban en una base aislada, no quedan vulnerabilidades críticas conocidas sin resolver y la documentación refleja cualquier limitación real.

## Decisiones pendientes del implementador

El implementador deberá elegir versiones compatibles y nombres internos concretos, documentar cualquier incompatibilidad y detenerse ante bloqueos reales de credenciales, Docker o datos externos.
