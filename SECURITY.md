# 🔒 Seguridad en SubiteYa

Este documento describe las medidas de seguridad implementadas en la aplicación.

## 🛡️ Autenticación y Autorización

### Tokens JWT

- **Access Tokens**: 15 minutos de duración (corto para minimizar riesgo)
- **Refresh Tokens**: 90 días de duración (sesión "infinita" pero renovable)
- **Almacenamiento**: Tokens en localStorage (consideración: migrar a httpOnly cookies en futuro)
- **Revocación**: Sistema de refresh tokens permite revocar sesiones específicas
- **Secrets**: JWT_SECRET y REFRESH_SECRET son OBLIGATORIOS (aplicación no inicia sin ellos)

### Contraseñas

- **Hashing**: PBKDF2 con SHA-512
- **Iteraciones**: 100,000 (resistente a ataques de fuerza bruta)
- **Salt**: 32 bytes aleatorios por usuario
- **Comparación**: `crypto.timingSafeEqual()` para prevenir timing attacks

### Sesiones Multi-Dispositivo

- Cada dispositivo obtiene un refresh token único
- Tokens pueden revocarse individualmente
- Tabla `RefreshToken` en base de datos con campos:
  - `tokenId`: Identificador único
  - `userId`: Usuario propietario
  - `expiresAt`: Fecha de expiración
  - `revokedAt`: Permite invalidar tokens

## 🔐 Headers de Seguridad

### Frontend (HTML)

```html
X-Content-Type-Options: nosniff X-Frame-Options: DENY X-XSS-Protection: 1;
mode=block Referrer-Policy: strict-origin-when-cross-origin
```

### Backend (Helmet.js)

```javascript
Content-Security-Policy: Protección contra XSS
Strict-Transport-Security: HTTPS obligatorio (31536000s)
X-Frame-Options: DENY (previene clickjacking)
X-Content-Type-Options: nosniff
```

## 🌐 CORS

### Configuración

- Origins permitidos configurables vía `ALLOWED_ORIGINS`
- Whitelist de dominios específicos
- Soporte para Vercel preview deployments (`*.vercel.app`)
- Credentials habilitados para cookies

### Logging

- Todas las peticiones CORS son logueadas
- Origins bloqueados se registran con detalles

## 📧 Emails

### Verificación de Cuenta

- Códigos de 64 caracteres (alta entropía)
- Válidos por 24 horas
- Un solo uso (se marcan como usados)
- Solo verificación vía URL (sin formulario manual)

### Reset de Contraseña

- Códigos de 64 caracteres
- Válidos por 1 hora (ventana corta)
- Un solo uso
- Solo reset vía URL del email

## 🔑 Variables de Entorno Requeridas

### Backend

```env
JWT_SECRET=<secret-key>              # OBLIGATORIO
REFRESH_SECRET=<refresh-secret>      # OBLIGATORIO
ENCRYPTION_KEY=<encryption-key>      # OBLIGATORIO
DATABASE_URL=<database-url>          # OBLIGATORIO
RESEND_API_KEY=<resend-key>         # Para emails
ALLOWED_ORIGINS=<origins>            # Para CORS
```

### Frontend

```env
VITE_API_URL=<api-url>              # URL del backend
```

## 🚨 Validaciones de Seguridad

### Startup Checks

1. ✅ JWT_SECRET presente (falla si no está)
2. ✅ REFRESH_SECRET presente (falla si no está)
3. ✅ ENCRYPTION_KEY presente y funcional
4. ✅ Conexión a base de datos

### Runtime Checks

1. ✅ Validación de tokens en cada request
2. ✅ Verificación de usuario existe en DB
3. ✅ Comprobación de tokens no revocados
4. ✅ Validación de expiración de tokens

## 🔄 Auto-Refresh de Tokens

### Mecanismo

- Frontend verifica expiración cada 5 minutos
- Refresh automático si quedan < 5 minutos
- Retry automático en 401 con nuevo token
- Prevención de refreshes concurrentes

### Flujo

```
1. Token expira en 5 minutos
2. Sistema detecta y refresca automáticamente
3. Usuario no ve interrupción
4. Si refresh falla → logout automático
```

## 📝 Mejores Prácticas Implementadas

### ✅ Implementado

- [x] Hashing robusto de contraseñas (PBKDF2)
- [x] Tokens JWT con expiración corta
- [x] Refresh tokens para sesiones largas
- [x] Headers de seguridad (Helmet)
- [x] CORS restrictivo
- [x] Validación de entradas
- [x] Logging de seguridad
- [x] HTTPS enforcement (HSTS)
- [x] Protección contra timing attacks
- [x] Codes de un solo uso para emails

### 🔄 Para Futuro

- [ ] Rate limiting por IP/usuario
- [ ] 2FA (autenticación de dos factores)
- [ ] Migrar tokens a httpOnly cookies
- [ ] Audit logs completos
- [ ] Detección de dispositivos nuevos
- [ ] Notificaciones de login desde dispositivos nuevos
- [ ] Captcha en login/register
- [ ] IP whitelisting para admin

## 🐛 Reporte de Vulnerabilidades

Si encuentras una vulnerabilidad de seguridad, por favor:

1. **NO** abras un issue público
2. Envía un email a: security@subiteya.com.ar
3. Incluye:
   - Descripción de la vulnerabilidad
   - Pasos para reproducirla
   - Impacto potencial
   - Sugerencias de mitigación (opcional)

Responderemos en 48 horas y trabajaremos en un fix prioritario.

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Helmet.js](https://helmetjs.github.io/)
- [PBKDF2 Specification](https://tools.ietf.org/html/rfc2898)

---

**Última actualización**: Noviembre 2025
**Versión de documento**: 1.0
