# VIP Client Email Draft Assistant — n8n Workflows

Sistema de automatización de respuestas de email con revisión humana para VIP Tech Consulting.

## Archivos

```
n8n-workflows/
├── 01_main_workflow.json          ← Importar en n8n (workflow principal)
├── 02_telegram_handler.json       ← Importar en n8n (workflow secundario)
├── sql/
│   └── 01_schema.sql              ← Ejecutar en Supabase/PostgreSQL
└── docs/
    ├── SETUP.md                   ← Instrucciones de configuración paso a paso
    ├── TESTING.md                 ← Guía de pruebas sin enviar emails reales
    └── PROMPTS.md                 ← Documentación de prompts de OpenAI
```

## Orden de implementación

1. **`sql/01_schema.sql`** — Crear las tablas en Supabase
2. **`docs/SETUP.md`** — Configurar todas las credenciales
3. **`02_telegram_handler.json`** — Importar y activar primero
4. **`01_main_workflow.json`** — Importar y activar segundo
5. **`docs/TESTING.md`** — Probar el sistema antes de poner en producción

## Flujo resumido

```
Email nuevo en Gmail
    → Normalizar + filtrar spam
    → Buscar cliente en QuickBooks
    → Obtener historial del thread
    → Cargar políticas + lecciones previas
    → Generar draft con GPT-4o
    → Guardar borrador en Gmail
    → Notificar en Telegram para revisión humana
    → Humano responde: APPROVE / EDIT / REJECT
    → Sistema aprende de cada corrección
```

## Garantías de seguridad

- **Nunca** envía emails automáticamente.
- **Siempre** requiere revisión humana antes del envío.
- Todos los drafts quedan como borradores en Gmail.
- El sistema aprende de cada corrección del equipo.

## Credenciales requeridas

| Credencial | Tipo en n8n |
|---|---|
| Gmail OAuth2 | `gmailOAuth2` |
| QuickBooks OAuth2 | `oAuth2Api` (genérico) |
| OpenAI API Key | `openAiApi` |
| Telegram Bot | `telegramApi` |
| PostgreSQL / Supabase | `postgres` |

## Variables de entorno en n8n

| Variable | Descripción |
|---|---|
| `QB_REALM_ID` | Company ID de QuickBooks Online |
| `TELEGRAM_CHAT_ID` | Chat ID del grupo/canal de Telegram |
| `GMAIL_LABEL_AI_REVIEW` | ID del label de Gmail para marcar emails procesados |
| `ENABLE_AUTO_SEND` | Siempre `false` en MVP |
