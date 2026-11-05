# Diseño UI/UX — Reestructuración SaaS

## Intención

Transformar el inventario en una aplicación SaaS clara y moderna, reduciendo la sensación de sistema legado y haciendo que cada módulo explique qué puede hacer el usuario y cuál es el siguiente paso.

## Objetivos

- Crear una navegación consistente con sidebar colapsable y encabezado contextual.
- Convertir Inventario en una pantalla de inicio útil, no solo en una tabla/formulario.
- Mejorar onboarding, estados vacíos, carga, errores y confirmaciones.
- Dar más espacio visual a formularios y reducir ruido en acciones secundarias.
- Hacer que móvil sea una experiencia completa, no una versión comprimida de escritorio.
- Mantener permisos, endpoints, offline sync, autenticación y modelos sin cambios.

## No objetivos

- No modificar reglas de negocio ni contratos API.
- No reemplazar Vue, Vue Router, Tailwind ni la validación Zod.
- No añadir gráficos que no ayuden a una decisión operativa.
- No eliminar funcionalidades existentes.

## Dirección visual

- Superficies claras, fondos neutros cálidos y acentos azul/índigo.
- Tipografía sans sobria con escalas amplias y títulos breves.
- Tarjetas con bordes suaves y sombras discretas, sin exceso de decoración.
- Un solo color de acción primaria por pantalla.
- Iconografía consistente mediante `@lucide/vue`.
- Estados vacíos con explicación, acción recomendada y recuperación visible.

## Estructura propuesta

1. **App shell:** sidebar colapsable, navegación agrupada, usuario y cierre de sesión; drawer en móvil.
2. **Inicio/Inventario:** bienvenida breve, métricas operativas, acciones rápidas, captura y movimientos, actividad reciente.
3. **Módulos:** encabezado con título, descripción, acción primaria, filtros y contenido; tablas convertidas en tarjetas en móvil.
4. **Formularios:** secciones por contexto, validación inline, guardado visible y protección contra pérdida de datos.
5. **Feedback:** toast o alertas consistentes para éxito/error, skeletons durante carga y estados vacíos accionables.

## Componentes shadcn-vue

Se ampliará la base existente con componentes pequeños y reutilizables: Button, Card, Badge, Input, Dialog/Drawer, DropdownMenu, Tabs, Table, Skeleton, Alert y Toast. Solo se incorporarán donde reduzcan duplicación real.

## Criterios de aceptación

- Todas las rutas autenticadas comparten el mismo shell y navegación.
- El usuario entiende la acción principal de cada pantalla en los primeros segundos.
- Las pantallas mantienen permisos y flujos actuales.
- Mobile, tablet y desktop tienen composición intencional.
- Tests frontend, build, E2E existentes y detector Impeccable pasan.
- No se introducen referencias a PrimeVue.
