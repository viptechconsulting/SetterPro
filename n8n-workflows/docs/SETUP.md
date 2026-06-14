# Setup Guide — VIP Client Email Draft Assistant

## Prerequisitos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| n8n | 1.30+ | Self-hosted o n8n Cloud |
| PostgreSQL / Supabase | PG 14+ | Se recomienda Supabase |
| Gmail / Google Workspace | Cualquiera | Cuenta con permisos de OAuth |
| QuickBooks Online | — | Cuenta con acceso a API |
| OpenAI | — | GPT-4o recomendado |
| Telegram | — | Bot creado con BotFather |

---

## Paso 1 — Base de Datos (Supabase o PostgreSQL)

### Opción A: Supabase (recomendada)

1. Ir a [supabase.com](https://supabase.com) y crear un proyecto.
2. En el dashboard, ir a **SQL Editor**.
3. Copiar y ejecutar el contenido de `sql/01_schema.sql`.
4. Anotar los datos de conexión:
   - **Host**: `db.<proyecto>.supabase.co`
   - **Puerto**: `5432`
   - **Database**: `postgres`
   - **User**: `postgres`
   - **Password**: el que configuraste al crear el proyecto

### Opción B: PostgreSQL propio

```bash
psql -U postgres -d tu_base_de_datos -f sql/01_schema.sql
```

### Verificar tablas creadas

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ai_email_drafts', 'ai_email_feedback_lessons', 'company_email_policies', 'email_processing_log');
```

---

## Paso 2 — Gmail OAuth2

### Crear proyecto en Google Cloud

1. Ir a [console.cloud.google.com](https://console.cloud.google.com).
2. Crear nuevo proyecto: **VIP Tech n8n**.
3. Habilitar las siguientes APIs:
   - **Gmail API**
4. Ir a **APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID**.
5. Tipo de aplicación: **Web application**.
6. Nombre: `n8n VIP Tech Gmail`.
7. URIs de redirección autorizados:
   ```
   https://tu-n8n.dominio.com/rest/oauth2-credential/callback
   ```
   *(Reemplazar con tu URL real de n8n)*
8. Anotar **Client ID** y **Client Secret**.

### Crear Gmail Labels antes de importar workflows

En Gmail, crear estas etiquetas manualmente o via API:

1. Abrir Gmail > Configuración > Ver toda la configuración > Etiquetas.
2. Crear etiqueta: `AI Draft Created`
3. Crear etiqueta: `Needs Human Review`
4. Anotar el ID de cada etiqueta (visible en la URL al hacer click en la etiqueta en Gmail).

O usar la API de Gmail para obtener el label ID:

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "https://gmail.googleapis.com/gmail/v1/users/me/labels"
```

Luego configurar en n8n la variable `GMAIL_LABEL_AI_REVIEW` con el ID obtenido.

### Configurar credencial en n8n

1. En n8n: **Credentials > New > Gmail OAuth2 API**.
2. Nombre: `Gmail OAuth2 – VIP Tech`
3. Client ID y Client Secret del paso anterior.
4. Hacer click en **Sign in with Google** y autorizar.

---

## Paso 3 — QuickBooks Online OAuth2

### Crear app en Intuit Developer

1. Ir a [developer.intuit.com](https://developer.intuit.com).
2. Crear cuenta / iniciar sesión.
3. **Dashboard > Create an App > QuickBooks Online and Payments**.
4. Nombre: `VIP Tech Email Assistant`.
5. En **Keys & credentials** (entorno Production):
   - Anotar **Client ID** y **Client Secret**.
6. En **Redirect URIs**, agregar:
   ```
   https://tu-n8n.dominio.com/rest/oauth2-credential/callback
   ```
7. En **Scopes**, seleccionar: `com.intuit.quickbooks.accounting`.

### Obtener Realm ID (Company ID)

El Realm ID es el ID de tu empresa en QuickBooks. Puedes verlo en la URL cuando estás logueado en QBO:

```
https://app.qbo.intuit.com/app/companyInfo
```

La URL tendrá algo como: `?companyId=123456789`

O ve a **Settings > Account and Settings > Billing & Subscription** — el Company ID aparece ahí.

### Configurar credencial en n8n

1. **Credentials > New > OAuth2 API** (genérico).
2. Nombre: `QuickBooks OAuth2 – VIP Tech`
3. Grant Type: `Authorization Code`
4. Authorization URL: `https://appcenter.intuit.com/connect/oauth2`
5. Access Token URL: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
6. Client ID y Client Secret de Intuit Developer.
7. Scope: `com.intuit.quickbooks.accounting`
8. Authentication: `Header`

### Configurar variable de entorno QB_REALM_ID

En n8n Settings > Variables:
```
QB_REALM_ID = 123456789  (tu Realm ID real)
```

---

## Paso 4 — OpenAI

1. Ir a [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Crear nueva API Key: `VIP Tech n8n`.
3. En n8n: **Credentials > New > OpenAI API**.
4. Nombre: `OpenAI – VIP Tech`
5. Pegar la API Key.

**Modelos usados:**
- Workflow principal: `gpt-4o` (generación de drafts)
- Telegram handler: `gpt-4o-mini` (extracción de lecciones — más económico)

---

## Paso 5 — Telegram Bot

### Crear el Bot

1. Abrir Telegram y buscar **@BotFather**.
2. Enviar `/newbot`.
3. Nombre del bot: `VIP Tech Email Review Bot`
4. Username: `viptech_email_review_bot` (debe ser único, ajustar si está tomado).
5. BotFather responderá con el **Token del Bot**.

### Obtener Chat ID

1. Agregar el bot a tu grupo de Telegram (o chatear directamente con él).
2. Enviar un mensaje al bot.
3. Visitar en el navegador:
   ```
   https://api.telegram.org/bot<TU_TOKEN>/getUpdates
   ```
4. En la respuesta JSON, buscar `"chat":{"id":XXXXXXXX}`. Ese es tu **Chat ID**.

### Configurar credencial en n8n

1. **Credentials > New > Telegram API**.
2. Nombre: `Telegram Bot – VIP Tech`
3. Access Token: el token de BotFather.

### Configurar variable de entorno

En n8n Settings > Variables:
```
TELEGRAM_CHAT_ID = -100XXXXXXXXX  (el chat ID con prefijo - si es grupo)
```

---

## Paso 6 — Variables de Entorno en n8n

Ir a **n8n Settings > Variables** y configurar:

| Variable | Valor | Descripción |
|---|---|---|
| `QB_REALM_ID` | `123456789` | Company ID de QuickBooks |
| `TELEGRAM_CHAT_ID` | `-100XXXXXXXXX` | Chat ID de Telegram |
| `GMAIL_LABEL_AI_REVIEW` | `Label_XXXXXXXX` | ID del label de Gmail |
| `ENABLE_AUTO_SEND` | `false` | Siempre false en MVP |

---

## Paso 7 — Importar Workflows en n8n

1. En n8n: **Workflows > Import from File**.
2. Importar `01_main_workflow.json`.
3. Repetir para `02_telegram_handler.json`.

### Actualizar credenciales en los nodos

Después de importar, cada nodo marcado con `CONFIGURE_ME_*` necesita actualizar la credencial:

1. Hacer click en el nodo.
2. En el campo **Credential**, seleccionar la credencial correcta creada anteriormente.
3. Los nodos a actualizar son:
   - Todos los nodos **Gmail** → `Gmail OAuth2 – VIP Tech`
   - **Search Customer in QuickBooks** → `QuickBooks OAuth2 – VIP Tech`
   - Todos los nodos **OpenAI** → `OpenAI – VIP Tech`
   - Todos los nodos **Telegram** → `Telegram Bot – VIP Tech`
   - Todos los nodos **PostgreSQL** → `Supabase PostgreSQL – VIP Tech`

### Configurar credencial PostgreSQL

1. **Credentials > New > Postgres**.
2. Nombre: `Supabase PostgreSQL – VIP Tech`
3. Host: `db.<proyecto>.supabase.co`
4. Puerto: `5432`
5. Database: `postgres`
6. User: `postgres`
7. Password: tu contraseña de Supabase
8. SSL: `Enable` (requerido por Supabase)

---

## Paso 8 — Activar Workflows

**IMPORTANTE:** Activar en este orden:

1. Primero activar `Telegram Draft Review Handler` (workflow secundario).
2. Luego activar `VIP Client Email Draft Assistant` (workflow principal).

Hacer click en el toggle **Active** en la esquina superior derecha de cada workflow.

---

## Paso 9 — Verificar Gmail Labels

Asegurarse de que los labels existen en Gmail antes de activar:

1. Abrir Gmail.
2. En el panel izquierdo, verificar que aparecen: `AI Draft Created` y `Needs Human Review`.
3. Si no existen, crearlos en Configuración > Etiquetas.
4. Obtener los IDs y actualizar la variable `GMAIL_LABEL_AI_REVIEW` en n8n.

---

## Arquitectura del Sistema

```
Email Entrante (Gmail)
       │
       ▼
  Gmail Trigger (polling cada 1 min)
       │
       ▼
  Normalize Email
       │
       ▼
  ¿Email humano? ──No──► Stop
       │ Sí
       ▼
  Buscar en QuickBooks
       │
       ├─No encontrado──► Telegram: alerta de contacto desconocido
       │
       │ Encontrado
       ▼
  Historial del Thread (Gmail)
       │
       ▼
  Políticas de empresa (PostgreSQL)
       │
       ▼
  Lecciones previas (PostgreSQL)
       │
       ▼
  Generar Draft (OpenAI gpt-4o)
       │
       ▼
  Crear Draft en Gmail
       │
       ▼
  Etiquetar email original
       │
       ▼
  Guardar en BD
       │
       ▼
  Notificar en Telegram
       │
       ▼
  [HUMANO REVISA EN TELEGRAM]
       │
       ├─ APPROVE → Actualizar BD, confirmar en Telegram
       ├─ EDIT    → Regenerar con IA, actualizar Draft, guardar lección
       └─ REJECT  → Marcar rechazado, guardar lección
```

---

## Costos Estimados (referencia)

| Servicio | Costo aproximado |
|---|---|
| OpenAI gpt-4o (por email) | ~$0.01–$0.03 |
| OpenAI gpt-4o-mini (lección) | ~$0.001 |
| n8n Cloud | Desde $20/mes |
| Supabase Free tier | $0 (hasta 500MB) |
| Telegram Bot | Gratuito |

Para 100 emails/mes con gpt-4o: ~$1–3 USD en OpenAI.
