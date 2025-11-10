# 📧 Configuración de Email - SubiteYa

## ✅ Implementado

Se ha integrado **nodemailer** con **Gmail SMTP** para envío automático de emails.

### 📨 Emails que se envían:

1. **Email de Verificación** - Cuando un usuario se registra
2. **Email de Bienvenida** - Cuando verifica su cuenta
3. **Email de Recuperación** - Cuando solicita resetear contraseña

---

## 🔧 Configuración en Gmail

### Paso 1: Activar verificación en 2 pasos

1. Ve a tu cuenta de Google: https://myaccount.google.com/security
2. En "Acceso a Google" → Click en "Verificación en 2 pasos"
3. Sigue los pasos para activarla

### Paso 2: Generar App Password

1. Ve a: https://myaccount.google.com/apppasswords
2. Selecciona:
   - **App**: Correo
   - **Dispositivo**: Otro (personalizado)
   - Nombre: "SubiteYa Backend"
3. Click en "Generar"
4. **Copia la contraseña de 16 caracteres** (sin espacios)

### Paso 3: Configurar en .env

```bash
EMAIL_USER=subiteyacontact@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop  # La que acabas de generar
```

---

## 🚀 Variables de Entorno Necesarias

### Desarrollo (packages/api/.env):

```bash
EMAIL_USER=subiteyacontact@gmail.com
EMAIL_PASSWORD=tu_app_password_aqui
FRONTEND_URL=http://localhost:5173
```

### Producción (Render):

```bash
EMAIL_USER=subiteyacontact@gmail.com
EMAIL_PASSWORD=tu_app_password_aqui
FRONTEND_URL=https://tu-app.vercel.app
```

---

## 🧪 Testing

### Probar envío de email:

1. Regístrate con un email real
2. Deberías recibir el código de verificación
3. Al verificar, recibirás el email de bienvenida
4. Prueba "Olvidé mi contraseña" para recibir el email de recuperación

### Logs en consola:

```
✅ Email de verificación enviado a: usuario@example.com
✅ Email de bienvenida enviado a: usuario@example.com
✅ Código de recuperación enviado a: usuario@example.com
```

---

## ⚠️ Límites de Gmail

- **500 emails/día** con cuenta gratuita
- **2000 emails/día** con Google Workspace

Si necesitas más, considera usar **SendGrid** o **Resend**.

---

## 📝 Próximos Pasos

1. **Obtener App Password de Gmail**
2. **Actualizar .env con EMAIL_PASSWORD**
3. **Actualizar RENDER_ENV_VARS.md para Render**
4. **Probar registro y verificación**
5. **Deployar a producción**

---

## 🐛 Solución de Problemas

### "Error enviando email"

- Verifica que EMAIL_PASSWORD sea correcto
- Verifica que tengas verificación en 2 pasos activada
- Verifica que el App Password sea el correcto

### "Authentication failed"

- Regenera el App Password
- Asegúrate de copiar los 16 caracteres sin espacios

### Emails no llegan

- Revisa carpeta de SPAM
- Verifica que EMAIL_USER sea correcto
- Revisa los logs de consola para ver si hay errores

---

**¡Listo!** 🎉 Ahora SubiteYa puede enviar emails automáticamente.
