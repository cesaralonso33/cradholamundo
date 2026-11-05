# Informe E2E y seguridad

## Movimiento de inventario desde la interfaz

Se añadió al flujo autenticado de Playwright una prueba que crea un producto único en el entorno de pruebas, registra una entrada desde la UI y verifica la cantidad persistida mediante `GET /api/products/{sku}`. La prueba está dirigida a la base PostgreSQL aislada configurada para E2E y requiere `E2E_ADMIN_PASSWORD`.

## Resultado de ejecución

`npm run test:e2e` no pudo completar el arranque: el servidor finalizó con `DATABASE_URL must be set before initializing the database client`. En este checkout no hay `.env`, `.env.test` ni `.env.e2e`, por lo que no se pudo ejecutar la transacción real ni confirmar el flujo Playwright. Configurar `DATABASE_URL` de una base de pruebas aislada y `E2E_ADMIN_PASSWORD`, y volver a ejecutar `npm run test:e2e`.

Las pruebas frontend no realizan solicitudes reales de inventario; el test unitario valida que el formulario construye el payload esperado y anuncia éxito. Los rechazos 409 se mantienen como error visible, y el formulario deshabilita el envío offline en vez de afirmar que el movimiento se guardó.
