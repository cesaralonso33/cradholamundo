# Diseño UI/UX — Pulido conservador

## Intención

Mejorar la claridad y comodidad de uso del inventario sin rediseñar la aplicación ni cambiar sus contratos funcionales.

## Objetivos

- Hacer visible y usable la navegación global en escritorio y móvil.
- Mejorar jerarquía visual de títulos, acciones, formularios y tablas.
- Unificar botones, campos, tarjetas, alertas y estados de carga/error.
- Reforzar accesibilidad: foco visible, etiquetas, contraste y tamaños táctiles.
- Mantener permisos, rutas, API, offline sync y flujos existentes.

## No objetivos

- No cambiar modelos, endpoints ni reglas de negocio.
- No introducir un dashboard completo ni una nueva arquitectura de estado.
- No reemplazar Tailwind ni añadir una dependencia visual pesada.

## Enfoque elegido

Se conservará el layout actual y se centralizarán pequeños patrones visuales reutilizables. La cabecera global tendrá mejor agrupación, separación y comportamiento responsive; en móvil podrá envolver los enlaces sin desbordar. Las vistas recibirán espaciado consistente, tarjetas de contenido, botones con jerarquía clara y mensajes de estado más visibles. Se mantendrán los enlaces condicionados por permisos.

## Áreas de trabajo

1. `App.vue`: navegación, usuario, salir y responsive.
2. `style.css`: tokens visuales ligeros, estados de foco, superficies y controles.
3. Vistas principales: Inventario, Papelería, Empleados y Settings.
4. Pruebas frontend para navegación, estados y ausencia de regresiones.

## Criterios de aceptación

- El menú es legible y accesible en móvil y escritorio.
- Las acciones primarias se distinguen de las secundarias.
- Los estados loading, vacío, error y éxito son visibles y consistentes.
- Tests frontend y build pasan.
- Detector Impeccable no reporta hallazgos críticos.
