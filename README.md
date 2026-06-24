# KM Entregas

Sistema de controle de coleta e entrega com multi-tenant.

## Variáveis de ambiente (configurar no Vercel)

```
SUPABASE_URL=https://ccwamzabidwvjtblcxxe.supabase.co
SUPABASE_SERVICE_KEY=sua_service_role_key
```

## Estrutura

```
api/          Edge Functions (servidor)
public/       Frontend estático
vercel.json   Configuração Vercel
```

## Deploy

1. Conectar repositório no Vercel
2. Configurar variáveis de ambiente
3. Deploy automático
