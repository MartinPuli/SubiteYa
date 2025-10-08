# 🎯 Configuración de TikTok OAuth

## Paso 1: Crear una App en TikTok for Developers

1. **Ve a**: https://developers.tiktok.com/

2. **Inicia sesión** con tu cuenta de TikTok

3. **Ve a "My apps"** → **"Create new app"**

4. **Completa el formulario**:
   - **App name**: SubiteYa
   - **Use case**: Content posting tool
   - **Category**: Developer tools
   - **Description**: Multi-account TikTok video publishing platform

5. **Click en "Next"**

## Paso 2: Configurar la App

1. En la configuración de tu app, ve a **"Login Kit"**

2. **Agrega los Redirect URIs**:

   ```
   http://localhost:3000/api/auth/tiktok/callback
   http://localhost:5173/auth/callback
   ```

3. **Selecciona los scopes** (permisos) necesarios:
   - ✅ `user.info.basic` - Información básica del usuario
   - ✅ `video.upload` - Subir videos
   - ✅ `video.publish` - Publicar videos

4. **Guarda los cambios**

## Paso 3: Obtener las Credenciales

En la configuración de tu app vas a encontrar:

- **Client Key** (también llamado App ID)
- **Client Secret**

**Cópialos** porque los vamos a usar en el `.env`.

## Paso 4: Actualizar el .env

Abrí el archivo `packages/api/.env` y actualizá estas líneas:

```env
# TikTok OAuth
TIKTOK_CLIENT_KEY=tu_client_key_aqui
TIKTOK_CLIENT_SECRET=tu_client_secret_aqui
TIKTOK_REDIRECT_URI=http://localhost:3000/api/auth/tiktok/callback
```

## Paso 5: Reiniciar el Servidor

```bash
# Presiona Ctrl+C
# Luego:
npm run dev
```

## 📝 Notas Importantes

### Sobre los Redirect URIs

TikTok requiere que configures los Redirect URIs **exactamente** como los vas a usar. Asegurate de agregar:

- `http://localhost:3000/api/auth/tiktok/callback` (para desarrollo)
- Cuando subas a producción, agregá también: `https://tudominio.com/api/auth/tiktok/callback`

### Sobre los Scopes

Los scopes que necesitás dependen de qué quieras hacer:

- `user.info.basic`: Ver nombre, avatar, username del usuario
- `video.upload`: Subir videos a TikTok
- `video.publish`: Publicar videos (hacerlos públicos)

### Limitaciones del Plan Free de TikTok

- **Request limits**: TikTok tiene rate limits estrictos
- **Review process**: Algunas apps necesitan aprobación de TikTok antes de publicar videos de otros usuarios
- **Test accounts**: Durante desarrollo podés usar tu propia cuenta

## 🔐 Seguridad

⚠️ **NUNCA** commitees el `.env` con tus credenciales reales al repositorio.

El archivo `.gitignore` ya incluye `.env`, pero verificalo:

```bash
# Verificar que .env está ignorado
git check-ignore packages/api/.env
```

## ✅ Próximos Pasos

Una vez que tengas las credenciales configuradas:

1. Reiniciá el servidor
2. Ve a la página de "Cuentas de TikTok" en el frontend
3. Click en "Conectar Cuenta"
4. Serás redirigido a TikTok para autorizar
5. Después de autorizar, volverás a SubiteYa con la cuenta conectada

---

**¿Ya tenés una cuenta en TikTok for Developers?** Si no, creala ahora y seguí estos pasos.
