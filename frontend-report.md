# Frontend: corrección de alta de empleados

El formulario de `Employees.vue` envía `name`, `position` y `email`. Se explicitó ese contrato en `apiCreateEmployee` usando el modelo `Employee`, y la prueba de `employeeSchema` ahora valida directamente el payload real del formulario. La validación requiere nombre y acepta posición/email opcionales; no exige `employee_number`, ausente tanto del formulario como del modelo backend.

La inspección de HEAD encontró que el esquema ya no contenía `employee_number`; la prueba anterior era insuficiente (combinaba nombre vacío con `employee_number` vacío, y podía pasar aunque el esquema no lo conociera). Por eso se reemplazó por el caso válido de formulario y se añadió una comprobación explícita del nombre requerido. No fue posible observar RED contra el esquema anterior porque esa versión no está en el checkout; el nuevo caso pasa en el estado existente. Backend y proyecto original no se modificaron.

Verificación: `npm test` y `npm run build` (resultados registrados al cerrar este cambio).
