# Ideas de automatización con IA (Gemini) para Propz

## Aclaración importante: ya tienes acceso a Gemini

El proyecto **ya está conectado a Gemini** a través del Lovable AI Gateway. El archivo `src/lib/service-extraction.server.ts` ya usa modelos como `google/gemini-3-flash` y `google/gemini-2.5-flash` para leer pantallazos de Servipag. **No necesitas una API key gratuita de Gemini por separado** — el gateway ya la gestiona. Solo necesitas un plan con créditos de AI Gateway (el workspace incluye una franquicia mensual gratuita).

## Procesos manuales actuales (oportunidades)

Tras revisar el código, estos son los procesos que hoy requieren acción manual del usuario:

1. **Conciliación de cartolas bancarias** — el usuario sube la cartola, el sistema parsea y hace matching por reglas (RUT, cuenta, nombre), pero las transacciones no coincidentes quedan para revisión manual.
2. **Confirmación/reverso de pagos** — el usuario confirma manualmente cada pago desde el dashboard.
3. **Ingreso de arrendatarios** — el usuario llena a mano nombre, RUT, monto, fechas.
4. **Carga de documentos de servicios** — el usuario sube pantallazos de Servipag (ya con IA, pero requiere acción).
5. **Monitoreo de vencimientos** — el sistema detecta, pero el usuario debe actuar.
6. **Búsqueda de información** — el usuario navega manualmente por propiedades/unidades para encontrar datos.

## Ideas de automatización con IA (ordenadas por impacto)

### 1. Conciliación inteligente de pagos con IA ⭐ (Alto impacto)

**Problema**: Cuando el motor de matching por reglas no encuentra coincidencia (`confidence: "none"` o `"manual"`), el usuario debe asociar manualmente cada transacción.

**Solución**: Usar Gemini para analizar la descripción de la transacción bancaria + datos del pagador y sugerir a qué unidad/tenant corresponde. El modelo recibe: la descripción cruda de la cartola, el RUT/nombre del pagador, y la lista de unidades activas con sus tenants. Devuelve el `unitId` más probable + nivel de confianza.

**Flujo**:
```
Cartola subida → parseo → matching por reglas → si confidence < exact →
  Gemini analiza descripción → sugiere unidad → usuario confirma/corrige
```

**Beneficio**: Reduce drásticamente el trabajo manual de conciliación. Las transacciones con RUT/cuenta coincidentes siguen por reglas (rápido y gratis); solo las ambiguas usan IA.

---

### 2. Lectura automática de contratos de arriendo (Alto impacto)

**Problema**: Al ingresar un nuevo arrendatario, el usuario debe transcribir manualmente nombre, RUT, monto, fechas, día de pago desde el contrato físico/PDF.

**Solución**: Permitir subir el contrato (PDF o foto) y que Gemini extraiga: nombre del arrendatario, RUT, monto del arriendo, fecha de inicio, fecha de término, día de pago, y datos de la garantía. Pre-llenar el formulario de la unidad con los datos extraídos para que el usuario solo revise y confirme.

**Beneficio**: Elimina la transcripción manual. Es la extensión natural del motor que ya lee Servipag.

---

### 3. Asistente de consultas en lenguaje natural (Medio impacto)

**Problema**: El usuario debe navegar múltiples pantallas para responder preguntas como "¿qué propiedades tienen arriendos atrasados en Las Condes?" o "¿cuánto cobré el mes pasado vs. este mes?".

**Solución**: Un chat o barra de consulta donde el usuario escribe en español natural y Gemini responde con datos del portfolio. El modelo recibe un resumen estructurado del estado actual (propiedades, pagos, servicios, alertas) y responde. No reemplaza las vistas existentes; las complementa.

**Ejemplos**:
- "¿Qué unidades están vacantes?" → lista con links
- "¿Cuánto debo cobrar este mes?" → total esperado + pendiente
- "¿Qué servicios están en estado crítico?" → lista

---

### 4. Clasificación automática de documentos (Medio impacto)

**Problema**: Hoy hay rutas separadas para cartolas bancarias y pantallazos de servicios. Si el usuario sube un documento al lugar equivocado, no funciona.

**Solución**: Un único punto de carga donde Gemini clasifica el documento (cartola bancaria, boleta de servicio, contrato de arriendo, otro) y lo enruta al procesador correcto automáticamente.

---

### 5. Detección de anomalias y predicciones (Medio impacto)

**Problema**: El usuario descubre problemas tarde (servicios que suben, pagos que se atrasan recurrentemente, contratos por vencer).

**Solución**: Análisis periódico con Gemini sobre los datos históricos del portfolio:
- Alertas de servicios con aumento sostenido (>20% vs. promedio)
- Tenants con patrón de pago tardío recurrente
- Predicción de flujo de caja del próximo mes basado en histórico

**Formato**: Tarjeta "Insights" en el dashboard, generado bajo demanda o semanalmente.

---

### 6. Resumen ejecutivo automático mensual (Medio impacto)

**Problema**: El usuario debe revisar múltiples secciones para entender el estado del mes.

**Solución**: Al final de cada mes (o bajo demanda), Gemini genera un resumen en texto natural: "Este mes cobraste $X de $Y esperado (Z%). N unidades atrasadas. Servicio de agua en propiedad X subió 30%. Contrato de propiedad Y vence en 20 días."

**Formato**: Tarjeta en el dashboard o email/notificación.

---

### 7. Auto-detección de "sin deuda" y registro automático (Bajo impacto, alta calidad de vida)

**Problema**: El usuario debe cargar documentos de servicios aunque no haya deuda, para mantener el monitoreo al día.

**Solución**: Cuando Gemini detecta "sin deuda" en un documento, registrar automáticamente el valor 0 sin requerir revisión manual del usuario. Hoy ya detecta "sin deuda" pero pasa por la bandeja de revisión.

---

## Recomendación de implementación

| Idea | Esfuerzo | Impacto | Recomendación |
|------|----------|---------|---------------|
| 1. Conciliación con IA | Medio | Alto | Empezar aquí |
| 2. Lectura de contratos | Medio | Alto | Segunda prioridad |
| 3. Asistente de consultas | Medio | Medio | Cuando el portfolio crezca |
| 4. Clasificación de docs | Bajo | Medio | Junto con idea 2 |
| 5. Detección de anomalías | Medio | Medio | Con datos históricos suficientes |
| 6. Resumen mensual | Bajo | Medio | Quick win |
| 7. Auto "sin deuda" | Bajo | Bajo | Quick win inmediato |

## Arquitectura propuesta

Todas las ideas usan el mismo patrón que ya funciona en `service-extraction.server.ts`:
- Server function con `createServerFn` + `requireSupabaseAuth`
- Llamada al Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
- Modelo: `google/gemini-3-flash` (rápido y económico) o `google/gemini-3.1-pro-preview` (más preciso para tareas complejas)
- Prompt estructurado con instrucciones claras + JSON de respuesta
- Validación de la respuesta en el servidor antes de usarla
