# Aplicar Migración de Refresh Tokens en Supabase

## Instrucciones

1. **Ir a Supabase Dashboard**
   - https://supabase.com/dashboard/project/_/sql/new

2. **Copiar y ejecutar el siguiente SQL:**

```sql
-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_id_key" ON "refresh_tokens"("token_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_id_idx" ON "refresh_tokens"("token_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

3. **Hacer clic en "Run"**

4. **Verificar que se creó la tabla:**
   - Ir a Table Editor
   - Buscar tabla `refresh_tokens`
   - Debe tener las columnas: id, user_id, token_id, expires_at, created_at, revoked_at

## Variables de Entorno (Opcional pero Recomendado)

Para mayor seguridad, agregar en Render Dashboard → Environment:

```
REFRESH_SECRET=tu-secret-key-diferente-del-jwt-secret
```

Si no la agregas, se usará un valor por defecto (menos seguro).

## ¿Qué hace esta migración?

Crea la tabla para almacenar refresh tokens activos. Esto permite:

- ✅ Sesiones "infinitas" con auto-refresh
- ✅ Múltiples dispositivos conectados simultáneamente
- ✅ Revocar tokens específicos (logout de un dispositivo)
- ✅ Mayor seguridad (access token expira en 15 minutos)
