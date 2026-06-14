# Testing Guide — VIP Client Email Draft Assistant

## Principio de Seguridad

> **El sistema NUNCA envía emails automáticamente.**
> Todos los drafts requieren aprobación humana explícita.
> El `APPROVE` solo cambia el estado en la BD — el envío es siempre manual desde Gmail.

---

## Fase 1 — Prueba de Base de Datos

### 1.1 Verificar tablas

```sql
-- Verificar políticas cargadas
SELECT COUNT(*) FROM public.company_email_policies WHERE active = true;
-- Esperado: 10

-- Verificar estructura de drafts
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_email_drafts'
ORDER BY ordinal_position;

-- Verificar estructura de lecciones
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_email_feedback_lessons'
ORDER BY ordinal_position;
```

### 1.2 Insertar draft de prueba manual

```sql
INSERT INTO public.ai_email_drafts (
  message_id, thread_id, draft_id, from_email,
  customer_name, company_name, original_subject,
  ai_risk_level, status
) VALUES (
  'test-msg-001', 'test-thread-001', 'test-draft-001',
  'testcliente@empresa.com', 'Cliente Test', 'Empresa Test S.A.',
  'Consulta sobre proyecto', 'medio', 'pending_review'
);

-- Verificar inserción
SELECT id, draft_id, status, created_at FROM public.ai_email_drafts;

-- Limpiar registro de prueba
DELETE FROM public.ai_email_drafts WHERE message_id = 'test-msg-001';
```

---

## Fase 2 — Prueba del Workflow de Telegram

Probar el workflow `Telegram Draft Review Handler` **antes** del workflow principal.

### 2.1 Insertar draft de prueba en BD

```sql
INSERT INTO public.ai_email_drafts (
  message_id, thread_id, draft_id, from_email, customer_name, company_name,
  original_subject, original_body, ai_case_summary, ai_risk_level,
  ai_suggested_reply, reasoning_for_human, status
) VALUES (
  'test-real-001',
  'thread-real-001',
  'DRAFT_TEST_ABC123',
  'cliente@suempresa.com',
  'Juan Pérez',
  'Empresa de Prueba S.A.',
  'Consulta sobre cotización',
  'Hola, quisiera saber el precio del servicio X',
  'Cliente consulta sobre precios. No hay cotización aprobada actualmente.',
  'bajo',
  'Estimado Juan, gracias por contactarnos. Revisaremos su consulta y le responderemos pronto.',
  'Respuesta prudente ya que no hay cotización aprobada.',
  'pending_review'
);
```

### 2.2 Probar comando APPROVE

En Telegram, enviar al bot:
```
APPROVE DRAFT_TEST_ABC123
```

Verificar en BD:
```sql
SELECT draft_id, status, approved_by, approved_at
FROM public.ai_email_drafts
WHERE draft_id = 'DRAFT_TEST_ABC123';
-- status debe ser 'approved'
```

### 2.3 Probar comando EDIT

Primero resetear el estado:
```sql
UPDATE public.ai_email_drafts SET status = 'pending_review' WHERE draft_id = 'DRAFT_TEST_ABC123';
```

En Telegram, enviar:
```
EDIT DRAFT_TEST_ABC123: El tono debe ser más formal. Mencionar que coordinaremos una reunión para discutir opciones.
```

Verificar:
- El bot responde con "Draft Actualizado"
- Aparece un nuevo draft en Gmail (o error controlado si el draft_id no existe en Gmail real)
- Se guarda una lección en la BD:

```sql
SELECT situation_type, lesson, created_at
FROM public.ai_email_feedback_lessons
ORDER BY created_at DESC LIMIT 5;
```

### 2.4 Probar comando REJECT

```sql
UPDATE public.ai_email_drafts SET status = 'pending_review' WHERE draft_id = 'DRAFT_TEST_ABC123';
```

En Telegram:
```
REJECT DRAFT_TEST_ABC123: La respuesta es muy genérica. No se menciona el seguimiento específico al servicio X.
```

Verificar:
```sql
SELECT draft_id, status, rejection_reason FROM public.ai_email_drafts WHERE draft_id = 'DRAFT_TEST_ABC123';
-- status debe ser 'rejected'
```

### 2.5 Probar comando inválido

En Telegram, enviar texto random:
```
hola como estas
```

El bot debe responder con el mensaje de ayuda de comandos.

---

## Fase 3 — Prueba del Workflow Principal (modo manual)

### 3.1 Preparar email de prueba

**IMPORTANTE:** Para probar sin riesgo, usa el modo de ejecución manual de n8n.

1. En n8n, abrir el workflow `VIP Client Email Draft Assistant`.
2. NO activar el workflow todavía.
3. Usar el nodo de inicio manual: click derecho en el nodo `Gmail Trigger` > **Execute Node**.

### 3.2 Inyectar datos de prueba (sin Gmail real)

En el nodo `Normalize Email`, usar **Test Step** con este JSON de entrada:

```json
{
  "id": "msg_test_real_001",
  "threadId": "thread_test_001",
  "from": "Carlos García <carlos@clienteejemplo.com>",
  "to": "info@viptechconsulting.com",
  "subject": "Consulta sobre mantenimiento del sistema",
  "date": "2026-06-14T10:30:00Z",
  "text": "Hola equipo de VIP Tech,\n\nEspero estén bien. Quería consultar sobre el mantenimiento de nuestro sistema CRM que instalaron el año pasado. Hemos notado que carga lento en las mañanas.\n\n¿Podrían revisar y decirnos qué está pasando?\n\nGracias,\nCarlos García\nGerente de Operaciones\nCliente Ejemplo S.A.",
  "html": "",
  "labelIds": ["INBOX", "UNREAD"],
  "snippet": "Hola equipo de VIP Tech, Espero estén bien..."
}
```

### 3.3 Ejecutar nodo por nodo

n8n permite ejecutar el workflow nodo por nodo en modo de prueba:

1. Click en **Test Workflow** (triángulo de play).
2. Revisar la salida de cada nodo.
3. Verificar que el nodo `Is Human Email?` evalúa como `true` para este email.
4. Verificar que `Search Customer in QuickBooks` devuelve datos correctos.

### 3.4 Probar el filtro de emails automáticos

Usar este JSON para verificar que el sistema rechaza emails automáticos:

```json
{
  "id": "msg_auto_001",
  "threadId": "thread_auto_001",
  "from": "noreply@mailchimp.com",
  "subject": "Tu newsletter semanal",
  "text": "Ver este email en tu navegador...",
  "labelIds": ["INBOX", "UNREAD"]
}
```

El workflow debe detenerse en `Stop – Automated Email` sin procesar más.

---

## Fase 4 — Prueba de Integración Completa (con email real)

### 4.1 Preparar cuenta de email de prueba

Recomendamos hacer la prueba con una cuenta de Gmail de prueba:

1. Crear cuenta Gmail de prueba: `prueba-viptech@gmail.com`
2. Configurar el Gmail Trigger para monitorear ESTA cuenta.
3. El n8n Gmail OAuth2 debe autenticarse con la cuenta de VIP Tech principal.

### 4.2 Enviar email de prueba real

Desde la cuenta de prueba, enviar un email a la cuenta de VIP Tech:

```
De: prueba-viptech@gmail.com
Para: info@viptechconsulting.com
Asunto: Pregunta sobre proyecto en curso
Cuerpo: Hola, tengo una consulta sobre el avance del proyecto que estamos desarrollando juntos. ¿Podemos coordinar una llamada esta semana?
```

### 4.3 Verificar el flujo completo

Checklist de verificación:

- [ ] El Gmail Trigger detectó el email (dentro de 1 minuto de polling).
- [ ] El nodo `Normalize Email` procesó el email correctamente.
- [ ] Se realizó la búsqueda en QuickBooks (verificar logs de n8n).
- [ ] Se generó el contexto del thread.
- [ ] OpenAI generó un JSON válido con todos los campos.
- [ ] Se creó el draft en Gmail (verificar en Gmail > Borradores).
- [ ] El draft tiene el asunto correcto: `Re: Pregunta sobre proyecto en curso`.
- [ ] Se guardó el registro en la BD:
  ```sql
  SELECT * FROM public.ai_email_drafts ORDER BY created_at DESC LIMIT 1;
  ```
- [ ] Se recibió la notificación en Telegram con el formato correcto.
- [ ] El email original en Gmail tiene el label `AI Draft Created` (o `Needs Human Review`).

### 4.4 Verificar draft en Gmail

1. Abrir Gmail.
2. Ir a **Borradores**.
3. El draft debe aparecer con:
   - Destinatario correcto.
   - Asunto con "Re: " prefijo.
   - Cuerpo generado por IA.
   - Asociado al thread original (si n8n/Gmail lo soporta).

**NUNCA hacer click en Enviar durante las pruebas.** El draft es solo para revisión.

---

## Fase 5 — Prueba de Escenarios Especiales

### 5.1 Cliente con balance vencido

Modificar temporalmente el mock de datos del cliente para incluir `balance > 0`:

En el nodo `Extract Customer Data`, el campo `balance` debe ser mayor a 0.
Verificar que:
- El `risk_level` en el JSON de OpenAI sea `medio` o `alto`.
- El `case_summary` mencione el balance.
- La `suggested_reply_body` no comprometa nuevo trabajo.

### 5.2 Email de cliente no registrado en QuickBooks

Si el email de prueba no tiene match en QuickBooks:
- El workflow debe tomar la rama "Customer Not Found".
- Debe llegar una notificación a Telegram con el formato de contacto desconocido.
- El workflow termina sin crear draft.

### 5.3 Error de QuickBooks

Para simular un error:
1. Usar un Realm ID incorrecto temporalmente.
2. n8n mostrará el error en el nodo HTTP Request.
3. Verificar que el error queda registrado en `email_processing_log`.

---

## Monitoreo en Producción

### Dashboard de estado

```sql
-- Resumen de hoy
SELECT
  status,
  COUNT(*) as cantidad,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60)::INT as minutos_promedio_revision
FROM public.ai_email_drafts
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY status;

-- Últimos 10 emails procesados
SELECT
  created_at,
  from_email,
  company_name,
  original_subject,
  ai_risk_level,
  status
FROM public.ai_email_drafts
ORDER BY created_at DESC
LIMIT 10;

-- Lecciones aprendidas esta semana
SELECT situation_type, lesson, created_at
FROM public.ai_email_feedback_lessons
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Alertas a configurar en n8n

Agregar un nodo de error handler al workflow principal que notifique por Telegram si algo falla:

```
⚠️ ERROR en Email Draft Assistant
Error: {{ $json.error }}
Workflow: {{ $workflow.name }}
Revisar logs en n8n.
```

---

## Checklist Pre-Producción

- [ ] Base de datos con todas las tablas creadas y políticas sembradas.
- [ ] Gmail OAuth2 funcionando (probar con un email real).
- [ ] QuickBooks OAuth2 funcionando (probar búsqueda de cliente existente).
- [ ] OpenAI API Key activa con créditos suficientes.
- [ ] Telegram Bot respondiendo comandos.
- [ ] Variables de entorno configuradas en n8n.
- [ ] Label de Gmail creado y ID configurado.
- [ ] Workflow `Telegram Draft Review Handler` activo PRIMERO.
- [ ] Workflow `VIP Client Email Draft Assistant` activo SEGUNDO.
- [ ] Prueba de email completa exitosa.
- [ ] Prueba de APPROVE exitosa.
- [ ] Prueba de EDIT exitosa con lección guardada.
- [ ] Prueba de REJECT exitosa con lección guardada.
- [ ] Ningún email enviado automáticamente durante todas las pruebas.
