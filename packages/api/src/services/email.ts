import { Resend } from 'resend';

// Debug logs
console.log('📧 EMAIL CONFIG:', {
  resendKey: process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing',
  frontend: process.env.FRONTEND_URL ? '✅ Set' : '❌ Missing',
});

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendVerificationEmail(
  email: string,
  name: string,
  code: string
): Promise<void> {
  if (!resend) {
    console.warn(
      '⚠️ Email service not configured (missing RESEND_API_KEY), skipping email'
    );
    return;
  }

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&code=${code}`;

  try {
    await resend.emails.send({
      from: 'SubiteYa <noreply@subiteya.com.ar>',
      to: email,
      subject: '✨ Verifica tu email - SubiteYa',
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f3f4f6;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #fe2c55 0%, #00f2ea 100%); 
            color: white; 
            padding: 48px 32px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.5px;
          }
          .content { 
            padding: 40px 32px;
            background: #ffffff;
          }
          .content p {
            margin: 0 0 16px 0;
            color: #374151;
            font-size: 16px;
            line-height: 1.6;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button { 
            display: inline-block;
            background: linear-gradient(135deg, #fe2c55 0%, #ff5e7e 100%);
            color: white !important;
            padding: 16px 48px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 18px;
            box-shadow: 0 4px 14px rgba(254, 44, 85, 0.4);
            transition: all 0.3s ease;
          }
          .info-box {
            background: #f9fafb;
            border-left: 4px solid #00f2ea;
            padding: 20px;
            margin: 24px 0;
            border-radius: 8px;
          }
          .info-box p {
            margin: 0;
            font-size: 14px;
            color: #6b7280;
          }
          .footer { 
            text-align: center; 
            color: #9ca3af; 
            font-size: 13px; 
            padding: 24px 32px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 Bienvenido a SubiteYa</h1>
          </div>
          <div class="content">
            <p>¡Hola <strong>${name}</strong>!</p>
            
            <p>Gracias por registrarte en SubiteYa. Para activar tu cuenta y comenzar a publicar en múltiples cuentas de TikTok, haz clic en el botón de abajo.</p>
            
            <div class="button-container">
              <a href="${verificationUrl}" class="button">✨ Verificar mi email</a>
            </div>
            
            <div class="info-box">
              <p><strong>⏰ Este enlace es válido por 24 horas</strong></p>
              <p>🔒 Si no solicitaste este registro, puedes ignorar este email de forma segura</p>
            </div>
          </div>
          <div class="footer">
            <p><strong>© 2025 SubiteYa</strong></p>
            <p>Automatiza tus publicaciones en TikTok</p>
            <p style="margin-top: 12px;">Este email fue enviado a ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    });
    console.log(`✅ Email de verificación enviado a: ${email}`);
  } catch (error) {
    console.error('❌ Error al enviar email de verificación:', error);
    throw new Error('No se pudo enviar el email de verificación');
  }
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  code: string
): Promise<void> {
  if (!resend) {
    console.warn(
      '⚠️ Email service not configured (missing RESEND_API_KEY), skipping email'
    );
    return;
  }

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?email=${encodeURIComponent(email)}&code=${code}`;

  try {
    await resend.emails.send({
      from: 'SubiteYa <noreply@subiteya.com.ar>',
      to: email,
      subject: '🔑 Recupera tu contraseña - SubiteYa',
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f3f4f6;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #fe2c55 0%, #00f2ea 100%); 
            color: white; 
            padding: 48px 32px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.5px;
          }
          .content { 
            padding: 40px 32px;
            background: #ffffff;
          }
          .content p {
            margin: 0 0 16px 0;
            color: #374151;
            font-size: 16px;
            line-height: 1.6;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button { 
            display: inline-block;
            background: linear-gradient(135deg, #fe2c55 0%, #ff5e7e 100%);
            color: white !important;
            padding: 16px 48px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 18px;
            box-shadow: 0 4px 14px rgba(254, 44, 85, 0.4);
            transition: all 0.3s ease;
          }
          .warning-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 24px 0;
            border-radius: 8px;
          }
          .warning-box p {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #856404;
          }
          .warning-box ul {
            margin: 8px 0 0 0;
            padding-left: 20px;
          }
          .warning-box li {
            color: #856404;
            font-size: 14px;
            margin: 4px 0;
          }
          .footer { 
            text-align: center; 
            color: #9ca3af; 
            font-size: 13px; 
            padding: 24px 32px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Recupera tu Contraseña</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${name}</strong>,</p>
            
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en SubiteYa. Haz clic en el botón de abajo para crear una nueva contraseña.</p>
            
            <div class="button-container">
              <a href="${resetUrl}" class="button">🔐 Restablecer contraseña</a>
            </div>
            
            <div class="warning-box">
              <p><strong>⚠️ Información importante:</strong></p>
              <ul>
                <li>Este enlace es válido por <strong>1 hora</strong></li>
                <li>Si no solicitaste este cambio, ignora este email</li>
                <li>Tu contraseña actual sigue siendo válida hasta que la cambies</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p><strong>© 2025 SubiteYa</strong></p>
            <p>Automatiza tus publicaciones en TikTok</p>
            <p style="margin-top: 12px;">Este email fue enviado a ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    });
    console.log(`✅ Email de recuperación enviado a: ${email}`);
  } catch (error) {
    console.error('❌ Error al enviar email de recuperación:', error);
    throw new Error('No se pudo enviar el email de recuperación');
  }
}

export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<void> {
  if (!resend) {
    console.warn(
      '⚠️ Email service not configured (missing RESEND_API_KEY), skipping email'
    );
    return;
  }

  try {
    await resend.emails.send({
      from: 'SubiteYa <noreply@subiteya.com.ar>',
      to: email,
      subject: '🎉 ¡Bienvenido a SubiteYa!',
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #fe2c55 0%, #00f2ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #fe2c55; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #00f2ea; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Tu cuenta está activada!</h1>
          </div>
          <div class="content">
            <p>¡Hola <strong>${name}</strong>!</p>
            
            <p>Tu email ha sido verificado exitosamente. ¡Ya puedes comenzar a usar SubiteYa!</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/login" class="button">Iniciar Sesión</a>
            </div>
            
            <h3>🚀 ¿Qué puedes hacer ahora?</h3>
            
            <div class="feature">
              <strong>📱 Conecta tu cuenta de TikTok</strong><br>
              Autoriza SubiteYa para publicar en tu nombre
            </div>
            
            <div class="feature">
              <strong>🎨 Crea patrones de marca</strong><br>
              Personaliza tus videos con logos, filtros y subtítulos
            </div>
            
            <div class="feature">
              <strong>📤 Publica automáticamente</strong><br>
              Programa tus publicaciones y olvídate del trabajo manual
            </div>
            
            <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
            
            <p>¡Gracias por confiar en SubiteYa! 💙</p>
          </div>
          <div class="footer">
            <p>© 2025 SubiteYa - Automatiza tus publicaciones en TikTok</p>
            <p>Este email fue enviado a ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    });
    console.log(`✅ Email de bienvenida enviado a: ${email}`);
  } catch (error) {
    console.error('❌ Error al enviar email de bienvenida:', error);
    // Don't throw error here, welcome email is not critical
  }
}
