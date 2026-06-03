# SetterPro — Setup Guide

## Requisitos
- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Cuenta en [Unipile](https://unipile.com) con API key
- (Opcional para F1) Cuenta en Stripe

---

## 1. Clonar e instalar

```bash
cd setterpro
npm install
cp .env.local.example .env.local
```

---

## 2. Supabase

### Opción A — Proyecto en la nube (recomendado para producción)

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Copiar `URL` y `anon key` desde Settings → API
3. Copiar `service_role key` (mantener en secreto)
4. Actualizar `.env.local`

### Opción B — Local

```bash
supabase start
# Esto imprime las URLs y keys locales
```

### Aplicar migración

```bash
supabase db push
# O si es local:
supabase migration up
```

La migración crea automáticamente:
- Tabla `workspaces`
- Tabla `workspace_members`
- Tabla `linkedin_accounts` con RLS estricto
- Trigger: auto-crear workspace al registrarse un usuario
- Función `get_user_workspace_ids()` para RLS

---

## 3. Unipile

1. Crear cuenta en [unipile.com](https://unipile.com)
2. Obtener API key desde el dashboard
3. Configurar `UNIPILE_API_KEY` y `UNIPILE_API_URL` en `.env.local`
4. Generar un webhook secret y configurar `UNIPILE_WEBHOOK_SECRET`

### Deploy de la Edge Function de webhook

```bash
supabase functions deploy unipile-webhook

# Configurar secrets en la Edge Function
supabase secrets set UNIPILE_API_KEY=tu_key
supabase secrets set UNIPILE_WEBHOOK_SECRET=tu_secret
supabase secrets set UNIPILE_API_URL=https://api2.unipile.com:13465
```

### Registrar la URL del webhook en Unipile

En el dashboard de Unipile, registrar:
```
https://TU_PROYECTO.supabase.co/functions/v1/unipile-webhook
```

Eventos a suscribir:
- `account.connected`
- `account.disconnected`
- `account.reconnected`
- `account.error`

---

## 4. Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

UNIPILE_API_KEY=uni_...
UNIPILE_API_URL=https://api2.unipile.com:13465
UNIPILE_WEBHOOK_SECRET=...

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 5. Correr localmente

```bash
npm run dev
# → http://localhost:3000
```

---

## Flujo de conexión de LinkedIn

```
1. Usuario va a /settings/accounts
2. Click "Conectar LinkedIn"
   → Frontend llama POST /api/linkedin/initiate (workspace_id)
   → API Route usa UNIPILE_API_KEY (solo backend) para obtener wizard URL
   → Devuelve { url: "https://auth.unipile.com/..." }
3. Frontend redirige al wizard de Unipile
   → Usuario ingresa sus credenciales de LinkedIn en la UI de UNIPILE
   → SetterPro NUNCA ve la contraseña
4. Unipile redirige a /callback/unipile?account_id=xxx&workspace_id=yyy
5. Callback page llama POST /api/linkedin/callback
   → Verifica sesión del usuario
   → Verifica membresía en el workspace
   → Llama a Unipile API para obtener perfil (display_name, avatar, etc.)
   → Guarda en linkedin_accounts con RLS
6. Redirect a /settings/accounts → cuenta aparece como "Conectada"
```

---

## Seguridad

- `UNIPILE_API_KEY` solo existe en variables de entorno del servidor (API Routes + Edge Functions)
- El cliente (browser) NUNCA recibe la API key
- RLS garantiza que ningún usuario puede ver cuentas de otro workspace
- Webhooks de Unipile verificados con HMAC-SHA256
- Credenciales de LinkedIn nunca tocan los servidores de SetterPro
