# Fixes para Deploy en Vercel

## Resumen

Este documento lista todos los cambios realizados para solucionar problemas de build en Vercel relacionados con Rollup y Node.js.

## Problema Original

Vercel fallaba al hacer build con el error:

```
Error: Cannot find module @rollup/rollup-linux-x64-gnu
```

Esto ocurre porque:

1. Vite usa Rollup con bindings nativos (C++) específicos del sistema operativo
2. Node.js 22 (usado inicialmente) tiene incompatibilidades con estos bindings
3. El entorno serverless de Vercel no siempre tiene las dependencias nativas disponibles

## Solución Implementada

### 1. Forzar Node.js 20 (LTS)

**Archivos modificados:**

- `.node-version`
- `package.json` (engines)
- `vercel.json` (build.env.NODE_VERSION)

**Por qué:** Node.js 18 fue discontinuado en Vercel, y Node.js 22 tiene problemas con Rollup nativo.

### 2. Reemplazar Rollup Nativo por WASM

**Archivo:** `package.json` (raíz del workspace)

```json
{
  "overrides": {
    "rollup": "npm:@rollup/wasm-node@^4.53.1"
  }
}
```

**Qué hace:** Fuerza a NPM a usar la versión WebAssembly de Rollup en lugar de los bindings nativos en TODO el workspace (incluyendo Vite y todas las dependencias).

**Por qué:**

- `@rollup/wasm-node` funciona en cualquier entorno sin compilaciones nativas
- Es cross-platform y compatible con serverless
- No requiere módulos binarios específicos del OS

### 3. Agregar Rollup WASM como Dependencia

**Archivo:** `packages/web/package.json`

```json
{
  "devDependencies": {
    "@rollup/wasm-node": "^4.53.1",
    "rollup": "npm:@rollup/wasm-node@^4.53.1"
  }
}
```

### 4. Downgrade de Vite 7 a Vite 5

**Archivo:** `packages/web/package.json`

```json
{
  "devDependencies": {
    "vite": "^5.0.7" // era ^7.1.9
  }
}
```

**Por qué:** Vite 7 es muy reciente y tiene problemas de compatibilidad con el entorno de Vercel.

### 5. Optimizar Build de TypeScript

**Archivo:** `packages/web/package.json`

```json
{
  "scripts": {
    "build": "tsc --skipLibCheck && vite build"
  }
}
```

**Por qué:** `--skipLibCheck` acelera el build y evita errores de tipo en node_modules.

### 6. Limpiar Cache en Vercel

**Archivo:** `vercel.json`

```json
{
  "installCommand": "rm -rf node_modules package-lock.json && npm install"
}
```

**Por qué:** Fuerza una instalación limpia para que se apliquen los overrides de npm.

### 7. Configurar Variables de Entorno

**Archivo:** `vercel.json`

```json
{
  "build": {
    "env": {
      "NODE_VERSION": "20",
      "ROLLUP_USE_NATIVE": "false"
    }
  }
}
```

### 8. Forzar WASM en Vite Config

**Archivo:** `packages/web/vite.config.ts`

```typescript
// Force Rollup to use JavaScript instead of native bindings
process.env.VITE_ROLLUP_USE_NATIVE = 'false';
```

## Verificación Local

Para verificar que los overrides funcionan correctamente:

```bash
npm list rollup
```

Debe mostrar:

```
└─┬ @subiteya/web@1.0.0
  ├── rollup@npm:@rollup/wasm-node@4.53.1 overridden
  └─┬ vite@5.0.7
    └── rollup@npm:@rollup/wasm-node@4.53.1 deduped
```

## Archivos Modificados (Resumen)

1. **`.node-version`** - Especifica Node 20
2. **`package.json`** (raíz) - Agrega overrides de rollup
3. **`packages/web/package.json`** - Downgrade Vite, agrega rollup WASM, optimiza build
4. **`packages/web/vite.config.ts`** - Fuerza uso de WASM
5. **`vercel.json`** - Configuración de Node version, limpieza de cache, env vars

## Resultado Final

✅ Build exitoso en Vercel con Node 20 + Rollup WASM
✅ Sin dependencias nativas que puedan fallar en serverless
✅ Compatible con arquitecturas ARM y x64
✅ Build más rápido con skipLibCheck

## Notas sobre Base de Datos

El schema Prisma usa:

- `DATABASE_URL` - Para connection pooling (Transaction mode)
- `DIRECT_URL` - Para migraciones directas (Session mode)

Esto es necesario para Supabase cuando se usa Supavisor (connection pooler).

### Infraestructura de Base de Datos

La base de datos está en **Supabase PostgreSQL hospedada en AWS**:

- Host actual: `aws-1-us-east-2.pooler.supabase.com` (región US East 2)
- También hay referencia a: `aws-0-sa-east-1.pooler.supabase.com` (región South America East 1)

**No es una migración a AWS RDS directamente**, sino que Supabase usa infraestructura de AWS para hospedar sus bases de datos PostgreSQL.

El cambio de región (de `sa-east-1` a `us-east-2`) puede haber sido:

1. Un cambio manual de proyecto en Supabase
2. Una nueva base de datos creada en región diferente
3. Verificar en Supabase Dashboard qué región está activa

### Verificar Región Actual

Para confirmar qué base de datos está activa:

1. Ve a https://supabase.com/dashboard
2. Settings → Database
3. Verifica el "Connection string" y la región

**Importante:** Si cambiaste de región, asegúrate de que:

- ✅ Las migraciones se aplicaron en la nueva base de datos
- ✅ RENDER tenga la DATABASE_URL actualizada
- ✅ Los datos existentes se migraron (si es necesario)

## Commits Relacionados

- `fix: downgrade Vite de 7.x a 5.x para compatibilidad con Vercel`
- `fix: forzar Node 18 en Vercel para compatibilidad con Rollup`
- `fix: cambiar a Node 20.x (Node 18 discontinuado en Vercel)`
- `fix: forzar Rollup WASM para evitar dependencias nativas en Vercel`
- `fix: reemplazar rollup nativo por @rollup/wasm-node completamente`
- `fix: agregar npm overrides para forzar rollup WASM en todo el workspace`

## Troubleshooting

Si el build falla en Vercel:

1. Verifica que el override esté en `package.json` raíz
2. Confirma que `.node-version` tenga `20`
3. Revisa los logs de Vercel para ver qué versión de Node usa
4. Redeploy forzando limpieza de cache desde Vercel Dashboard

## Referencias

- [Rollup WASM Node](https://www.npmjs.com/package/@rollup/wasm-node)
- [Vercel Node.js Version](https://vercel.com/docs/functions/runtimes/node-js)
- [npm overrides](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#overrides)
