# Corrección del módulo de importación y conciliación

Cambios acotados a: parsers, `_authenticated.rent.import.tsx`, dashboard (editar monto), esquema BD para multi-RUT y clave única de cartola. Nada más se toca.

## 1. Fechas sin corrimiento (PDF y Excel)

**Problema:** `parseDate` para PDF construye `Date` en distintos husos; el Excel con `cellDates:true` devuelve `Date` en UTC-medianoche, que al leer con `getDate()` local en Chile queda un día antes. `formatDate` también usa `new Date(iso)` (UTC).

**Fix:**
- `parseDate` en `bank-parsers.ts`: mantener strings `YYYY-MM-DD`; para `Date` de Excel usar `getUTCFullYear/Month/Date`; para serial numérico usar `XLSX.SSF.parse_date_code` (ya OK).
- `formatDate` en `format.ts`: parsear el ISO como piezas (`[y,m,d]`) sin `new Date(iso)`, para no depender del huso.

## 2. Parser PDF Scotiabank por columnas

**Problema:** el parser actual toma el último número de la línea como monto; en Scotiabank hay columnas `Cargos | Abonos | Saldo`, y el "último" suele ser el saldo, no el abono.

**Fix:** en `parsePdf`:
- Detectar encabezados `Fecha`, `Cargos`, `Abonos`, `Saldo` en la primera línea con esas palabras y capturar sus coordenadas `x`.
- Para cada línea con fecha, tomar el número cuya `x` cae bajo la columna `Abonos`. Ignorar `Saldo` y `Cargos`.
- Si no se detectan columnas (otros bancos), caer al heurístico actual.

## 3. Múltiples RUT por contrato

**Esquema:** nueva columna `rentable_units.tenant_ruts text[] not null default '{}'`. Se conserva `tenant_rut` como legado; los parsers indexan por unión de ambos.

**UI:** en la ficha de unidad (`_authenticated.properties.$id.edit.tsx`) agregar un campo "RUTs autorizados (uno por línea)" que edita `tenant_ruts`. Sin tocar el resto del formulario.

## 4. Almacenamiento de múltiples cartolas + clave única

**Esquema:**
- `bank_statement_imports`: añadir `account_number text`, `statement_downloaded_at timestamptz default now()`, `raw_transactions jsonb`, `applied boolean default false`.
- Índice único parcial `(organization_id, bank_name, account_number, period_year, period_month)` — el nuevo upload reemplaza al anterior con el mismo cuarteto: borrar los `bank_transactions`/`rent_payment_allocations` derivados de la versión anterior y crear la nueva versión.

**UI Importar:** el flujo ahora pide seleccionar **banco**, **cuenta**, **mes** y **año** al subir (auto-completados desde el PDF cuando se detecten). Al aplicar:
1. Insert de `bank_statement_imports` con esos campos + `raw_transactions`.
2. Si existía versión previa con misma clave, borrarla en cascada.
3. Continuar el flujo normal de match/aplicación.

## 5. Aplicar a Arriendos: agrupación y error

**Fix del error `[object Object]`:** serializar errores Supabase con `err.message ?? err.error_description ?? JSON.stringify(err)`.

**Agrupación:** antes de crear allocations, agrupar por `(unidad, año, mes)` sumando todos los `bank_transactions` que caen ahí (incluyendo múltiples RUT del mismo contrato y múltiples abonos del mismo RUT). Un solo `rent_payment` por período; una `allocation` por transacción (para trazabilidad), o una consolidada si prefieren — el trigger recalcula `amount_paid`.

**Flag `Requiere revisión`:** si el total asignado difiere en >20% (por exceso o defecto) del `base_rent_amount`, marcar `rent_payments.notes = 'REVIEW'` y agregar columna `needs_review boolean default false`. El panel mensual muestra badge ámbar "Requiere revisión".

## 6. Editar monto desde el panel mensual

**UI:** en cada `PaymentRow` del dashboard, un botón "Editar monto" abre un prompt (o input inline) que hace `UPDATE rent_payments SET amount = X` para el período. Ya se puede editar `amount_paid` vía allocations parciales; ahora también el monto esperado del mes.

## 7. Conciliación consolidada

Al aplicar cartolas, el sistema:
- Recorre **todas** las `bank_statement_imports` no aplicadas (o todas las últimas versiones por clave única).
- Une los RUTs de cada unidad (`tenant_rut` + `tenant_ruts[]`).
- Para cada unidad × período, suma todos los abonos coincidentes y crea/actualiza `rent_payments` idempotentemente (upsert por `unit_id + period_year + period_month`).
- No duplica: cada `bank_transaction` sólo genera una `allocation` (índice único `(bank_transaction_id)` en `rent_payment_allocations` si aún no existe).

## Detalles técnicos

- Migración SQL:
  ```sql
  ALTER TABLE public.rentable_units ADD COLUMN tenant_ruts text[] NOT NULL DEFAULT '{}';
  ALTER TABLE public.bank_statement_imports
    ADD COLUMN account_number text,
    ADD COLUMN statement_downloaded_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN raw_transactions jsonb,
    ADD COLUMN applied boolean NOT NULL DEFAULT false;
  CREATE UNIQUE INDEX bank_statement_unique_key
    ON public.bank_statement_imports(organization_id, bank_name, account_number, period_year, period_month)
    WHERE bank_name IS NOT NULL AND account_number IS NOT NULL;
  ALTER TABLE public.rent_payments ADD COLUMN needs_review boolean NOT NULL DEFAULT false;
  CREATE UNIQUE INDEX rent_allocations_one_per_tx
    ON public.rent_payment_allocations(bank_transaction_id)
    WHERE bank_transaction_id IS NOT NULL;
  ```
- No se tocan: propiedades, contratos, autenticación, ni otras funciones del módulo.

## Confirmación

¿Procedo con este alcance? En particular:
- **Editar monto del mes**: ¿inline o modal? Voy con prompt simple si no hay preferencia.
- **RUTs por contrato**: se guardan en la unidad (no hay tabla `contracts` separada aún). ¿OK?
