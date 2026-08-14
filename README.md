# Propz 5.0

PROMPT MAESTRO PARA LOVABLE — PLATAFORMA INTELIGENTE DE ADMINISTRACIÓN DE PROPIEDADES

Quiero desarrollar una aplicación web SaaS, escalable y 100% personalizada para la administración inteligente de propiedades en arriendo.

El sistema debe servir inicialmente para administrar mi propia cartera de propiedades, pero debe estar diseñado desde el inicio para escalar a cientos o miles de propiedades y ofrecer tres modelos:

Autogestión: el propietario administra sus propias propiedades usando el software.

Gestión asistida: el propietario usa el software y contrata servicios específicos.

Administración completa: un administrador profesional gestiona las propiedades y cobra una comisión configurable.

PRINCIPIO CENTRAL DE DISEÑO

La experiencia de usuario debe ser extremadamente simple, intuitiva y visual.

El usuario no debe necesitar conocimientos técnicos ni inmobiliarios avanzados.

El sistema debe funcionar principalmente por excepción:

Si todo está bien, el usuario no necesita hacer nada.

El sistema automatiza, recuerda y hace seguimiento.

Solo muestra al usuario aquello que requiere su atención, decisión o autorización.

El dashboard principal debe responder inmediatamente:

¿Qué está bien?

¿Qué está pendiente?

¿Qué está vencido?

¿Qué requiere mi autorización?

¿Qué requiere que yo intervenga hoy?

Evitar interfaces sobrecargadas, formularios innecesariamente largos y procesos complejos.

1. ARQUITECTURA DE PROPIEDADES Y UNIDADES ARRENDABLES

Una propiedad puede contener múltiples unidades arrendables.

Ejemplo:

Propiedad: Departamento 1204

Departamento

Estacionamiento 34

Bodega 18

Cada unidad puede:

Arrendarse independientemente.

Incluirse en otro contrato.

Tener un arrendatario diferente.

Tener un valor de arriendo propio.

Tener fechas de contrato diferentes.

El sistema debe soportar:

Departamentos.

Casas.

Oficinas.

Locales comerciales.

Estacionamientos.

Bodegas.

Otros tipos configurables.

Cada propiedad debe tener una ficha central con:

Propietario o propietarios.

Dirección.

Características.

Fotografías.

Documentos.

Unidades arrendables.

Contratos.

Arrendatarios.

Ingresos.

Gastos.

Obligaciones.

Mantenciones.

Historial.

Rentabilidad.

2. ROLES DEL SISTEMA

Crear diferentes perfiles y permisos:

Superadministrador

Administra toda la plataforma, usuarios, planes, configuraciones, integraciones y reglas globales.

Administrador de propiedades

Puede gestionar las propiedades que tenga asignadas.

Propietario

Puede visualizar y gestionar sus propiedades según el plan contratado.

Arrendatario

Puede:

Ver su contrato.

Ver sus cobros.

Pagar.

Ver comprobantes.

Consultar obligaciones.

Reportar problemas.

Adjuntar fotos y videos.

Comunicarse con el Administrador Virtual IA.

Informar intención de término de contrato.

Proveedor

Puede:

Recibir solicitudes.

Realizar visitas.

Enviar diagnósticos.

Enviar cotizaciones.

Coordinar trabajos.

Adjuntar boletas o facturas.

Actualizar estados.

Referidor

Puede recomendar potenciales arrendatarios mediante un link o código único y recibir una recompensa cuando corresponda.

3. DASHBOARD PRINCIPAL POR EXCEPCIÓN

El dashboard debe priorizar acciones y no simplemente mostrar estadísticas.

Ejemplo:

HOY REQUIERE TU ATENCIÓN

3 gastos requieren autorización.

7 arriendos están vencidos.

4 casos fueron escalados por la IA.

2 contratos vencen próximamente.

3 cuentas de servicios están próximas a vencer.

1 propiedad quedará vacante.

5 mantenciones están en proceso.

También mostrar:

Total recaudado este mes.

Total pendiente.

Morosidad.

Ingresos.

Gastos.

Comisiones.

Rentabilidad.

Propiedades ocupadas y vacantes.

Usar semáforos visuales:

Verde: todo correcto.
Amarillo: atención próxima.
Rojo: requiere acción.
Gris: cerrado o informativo.

4. COBRANZA Y PAGOS

Cada contrato debe generar automáticamente sus cobros mensuales.

El arrendatario debe poder pagar idealmente desde la plataforma.

El sistema debe soportar:

Pago online.

Transferencia bancaria.

Conciliación automática o manual.

Pagos parciales.

Saldos pendientes.

Recargos configurables.

Comprobantes.

Historial completo.

Estados:

Próximo a vencer.

Pendiente.

Pagado.

Pago parcial.

Vencido.

En gestión.

Escalado.

5. MOTOR AUTOMÁTICO DE NOTIFICACIONES Y ESCALAMIENTO

Crear un motor configurable de notificaciones automáticas.

Debe funcionar para:

Arriendos.

Gastos comunes.

Luz.

Agua.

Gas.

Contribuciones.

Derechos de aseo.

Seguros.

Mantenciones.

Contratos.

Cualquier obligación configurable.

Canales:

WhatsApp.

Correo electrónico.

Notificaciones dentro de la plataforma.

Ejemplo de flujo configurable:

X días antes del vencimiento: recordatorio.

Día del vencimiento: aviso.

X días después: primer aviso de atraso.

Segundo recordatorio.

Último recordatorio automático.

Si continúa pendiente: escalar al administrador o propietario responsable.

Todo debe quedar registrado:

Mensaje enviado.

Destinatario.

Fecha y hora.

Canal.

Estado de entrega cuando la integración lo permita.

Respuesta.

Acción generada.

6. ADMINISTRADOR VIRTUAL CON INTELIGENCIA ARTIFICIAL

Crear un Administrador Virtual IA capaz de interactuar con los arrendatarios principalmente mediante WhatsApp, email y chat de la plataforma.

La IA no debe ser solamente un chatbot.

Debe poder:

Comprender el mensaje.

Identificar al usuario.

Identificar la propiedad y contrato.

Consultar información autorizada del sistema.

Hacer preguntas para obtener antecedentes.

Clasificar el problema.

Convertir conversaciones en datos estructurados.

Crear incidencias y tareas.

Activar workflows.

Hacer seguimiento.

Resolver consultas simples.

Escalar a una persona cuando corresponda.

Ejemplos:

“¿Cuánto tengo que pagar?”

“¿Cuándo vence mi contrato?”

“Pagué y todavía aparece pendiente.”

“No tengo agua caliente.”

“Hay una filtración.”

“Quiero dejar el departamento.”

La IA debe mantener una conversación natural, pero cada conversación relevante debe quedar asociada a:

Usuario.

Propiedad.

Unidad.

Contrato.

Categoría.

Prioridad.

Responsable.

Estado.

Historial de acciones.

7. REGLA FUNDAMENTAL PARA REPARACIONES Y GASTOS

La IA nunca debe asumir automáticamente que un problema reportado por el arrendatario corresponde económicamente al propietario.

Cuando un arrendatario reporta un problema:

La IA recibe el reclamo.

Solicita información, fotos o videos si corresponde.

Clasifica el problema.

Revisa antecedentes disponibles.

Determina si el caso parece:

Responsabilidad probable del arrendatario.

Responsabilidad probable del propietario.

Responsabilidad incierta.

Emergencia.

ANTES DE SOLICITAR UNA COTIZACIÓN QUE PUEDA GENERAR COSTOS PARA EL PROPIETARIO, EL PROPIETARIO O ADMINISTRADOR AUTORIZADO DEBE DECIDIR SI CORRESPONDE INICIAR EL PROCESO DE COTIZACIÓN.

Ejemplo:

“Arrendatario reporta que una puerta no cierra correctamente.”

El propietario recibe:

NUEVO PROBLEMA REPORTADO

Propiedad.

Arrendatario.

Descripción.

Fotografías/videos.

Evaluación inicial de la IA.

Historial relevante.

Acciones:

[AUTORIZAR COTIZACIÓN]
[NO CORRESPONDE AL PROPIETARIO]
[SOLICITAR MÁS INFORMACIÓN]
[RESOLVER DE OTRA FORMA]

Solo después de autorizar la cotización se debe activar el proceso con proveedores.

Luego:

Se solicita una o más cotizaciones.

Se presentan al propietario.

El propietario autoriza o rechaza el gasto.

Solo después de la autorización final se coordina la ejecución.

Se registra factura o boleta.

Se registra el gasto.

Se verifica la solución con el arrendatario.

Se cierra el caso.

Flujo:

REPORTE
→ ANÁLISIS IA
→ AUTORIZACIÓN PARA COTIZAR
→ COTIZACIÓN
→ AUTORIZACIÓN DEL GASTO
→ EJECUCIÓN
→ VERIFICACIÓN
→ REGISTRO DEL GASTO
→ CIERRE

El sistema debe permitir excepciones configurables para:

Gastos menores bajo un monto definido.

Emergencias.

Protocolos previamente autorizados.

Estas excepciones nunca deben estar codificadas de forma rígida. Cada propietario o contrato de administración debe poder definir sus reglas.

8. GESTIÓN DE OBLIGACIONES Y CUENTAS

Cada propiedad debe tener un Centro de Obligaciones.

Debe consolidar:

Luz.

Agua.

Gas.

Gastos comunes.

Contribuciones.

Derechos de aseo.

Seguros.

Otras obligaciones.

La información puede ingresar mediante:

Integraciones API.

Integraciones con proveedores de pago.

Lectura de correos electrónicos autorizados.

Extracción de información desde PDF.

Carga manual.

IA para interpretar documentos.

Cada obligación debe tener:

Propiedad.

Tipo.

Responsable del pago.

Monto.

Fecha de emisión.

Fecha de vencimiento.

Estado.

Documento asociado.

Historial de notificaciones.

Comprobante de pago.

9. CUENTA CORRIENTE Y RENTABILIDAD DE CADA PROPIEDAD

Cada propiedad debe funcionar como una unidad económica.

Registrar:

Ingresos por arriendo.

Ingresos por estacionamientos.

Ingresos por bodegas.

Otros ingresos.

Gastos comunes.

Mantenciones.

Contribuciones.

Derechos de aseo.

Seguros.

Comisiones.

Otros gastos.

Calcular:

Ingreso bruto.

Ingreso neto.

Rentabilidad.

Morosidad.

Vacancia.

Gastos históricos.

Flujo mensual y anual.

10. VACANCIA Y BÚSQUEDA DE NUEVOS ARRENDATARIOS

Cuando un arrendatario informa que dejará una propiedad, iniciar un workflow automático:

Registrar fecha estimada de salida.

Revisar deudas.

Revisar servicios.

Revisar gastos comunes.

Coordinar inspección.

Gestionar garantía.

Preparar la propiedad para publicación.

Reutilizar fotografías y descripción.

Crear ficha pública.

Gestionar interesados.

Registrar referidos.

Crear un sistema de referidos mediante:

Link único.

Código.

QR.

Debe permitir identificar quién recomendó al nuevo arrendatario y registrar una recompensa o comisión cuando corresponda.

11. MODELOS COMERCIALES

El sistema debe permitir:

Autogestión

El propietario usa directamente el software.

Gestión asistida

El propietario usa el software y contrata servicios específicos.

Administración completa

Un administrador gestiona la propiedad y cobra una comisión.

Las comisiones deben ser configurables por:

Cliente.

Propiedad.

Contrato.

Tipo de servicio.

Nunca dejar porcentajes fijos en el código.

12. TRAZABILIDAD TOTAL

Toda acción importante debe quedar registrada.

Registrar:

Quién realizó la acción.

Fecha y hora.

Cambio realizado.

Autorizaciones.

Rechazos.

Mensajes.

Cotizaciones.

Pagos.

Documentos.

Acciones realizadas por IA.

Acciones realizadas por humanos.

La IA nunca debe ocultar acciones ni modificar información crítica sin trazabilidad.

13. DISEÑO Y EXPERIENCIA DE USUARIO

Crear una aplicación moderna, profesional, limpia y extremadamente intuitiva.

Prioridades:

Mobile first y responsive.

Navegación simple.

Máximo valor con pocos clics.

Lenguaje cotidiano.

Evitar tecnicismos innecesarios.

Formularios cortos y progresivos.

Acciones principales claramente visibles.

Dashboard basado en prioridades.

Buscador global.

Filtros simples.

Estados visuales.

Línea de tiempo por propiedad, contrato e incidencia.

El sistema debe sentirse como un “administrador inteligente”, no como un software contable complejo.

14. ARQUITECTURA TÉCNICA

Diseñar una arquitectura:

SaaS.

Multiusuario.

Multiempresa / multi-tenant.

Escalable.

Modular.

Segura.

Preparada para integraciones externas.

La información de cada cliente debe estar completamente aislada mediante permisos y políticas de acceso.

Preparar la arquitectura para integrar posteriormente:

Pasarelas de pago.

Bancos o conciliación bancaria.

WhatsApp Business.

Servicios de email.

IA.

Lectura de documentos.

Servicios de utilities.

Gastos comunes.

Firma electrónica.

Proveedores externos.

No simular integraciones como si estuvieran realmente conectadas. Cuando una integración todavía no exista, crear la interfaz y arquitectura preparada para conectarla posteriormente e indicar claramente que funciona con datos de prueba.

15. OBJETIVO DE LA PRIMERA ETAPA

No construir todo de una sola vez.

Primero:

Diseñar la arquitectura general.

Crear el modelo de datos escalable.

Crear autenticación y roles.

Crear propiedades y unidades arrendables.

Crear propietarios y arrendatarios.

Crear contratos.

Crear cobros y obligaciones.

Crear dashboard por excepción.

Crear sistema de incidencias.

Crear estructura del Administrador Virtual IA.

Antes de implementar integraciones externas complejas, construir correctamente el núcleo funcional y la experiencia de usuario.

IMPORTANTE:

No tomar decisiones arbitrarias sobre reglas de negocio críticas.

Si falta información necesaria para una decisión importante de arquitectura o negocio, preguntar antes de implementarla.

Priorizar siempre:

SIMPLICIDAD + AUTOMATIZACIÓN + TRAZABILIDAD + ESCALABILIDAD + CONTROL DEL PROPIETARIO.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://propzchile.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7762528b-89bc-483f-bc04-c3afdec8bed2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
