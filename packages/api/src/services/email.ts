import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'subiteyacontact@gmail.com',
    pass: process.env.EMAIL_PASSWORD, // App Password de Gmail
  },
});

export async function sendVerificationEmail(
  email: string,
  name: string,
  code: string
): Promise<void> {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&code=${code}`;

  const mailOptions = {
    from: `"SubiteYa" <${process.env.EMAIL_USER || 'subiteyacontact@gmail.com'}>`,
    to: email,
    subject: '✨ Verifica tu email - SubiteYa',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #fe2c55 0%, #00f2ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: white; border: 2px dashed #fe2c55; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
          .code { font-size: 14px; font-family: monospace; color: #fe2c55; word-break: break-all; }
          .button { display: inline-block; background: #fe2c55; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 Bienvenido a SubiteYa</h1>
          </div>
          <div class="content">
            <p>¡Hola <strong>${name}</strong>!</p>
            
            <p>Gracias por registrarte en SubiteYa. Para activar tu cuenta, necesitamos verificar tu dirección de email.</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0;"><strong>Tu código de verificación es:</strong></p>
              <div class="code">${code}</div>
            </div>
            
            <p>O puedes hacer clic en el siguiente botón:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verificar mi email</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              ⏰ Este código es válido por <strong>24 horas</strong><br>
              🔒 Si no solicitaste este registro, ignora este email
            </p>
          </div>
          <div class="footer">
            <p>© 2025 SubiteYa - Automatiza tus publicaciones en TikTok</p>
            <p>Este email fue enviado a ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
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
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?email=${encodeURIComponent(email)}&code=${code}`;

  const mailOptions = {
    from: `"SubiteYa" <${process.env.EMAIL_USER || 'subiteyacontact@gmail.com'}>`,
    to: email,
    subject: '🔑 Recupera tu contraseña - SubiteYa',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #fe2c55 0%, #00f2ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: white; border: 2px dashed #fe2c55; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
          .code { font-size: 14px; font-family: monospace; color: #fe2c55; word-break: break-all; }
          .button { display: inline-block; background: #fe2c55; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Recuperación de Contraseña</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${name}</strong>,</p>
            
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en SubiteYa.</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0;"><strong>Tu código de recuperación es:</strong></p>
              <div class="code">${code}</div>
            </div>
            
            <p>O puedes hacer clic en el siguiente botón:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Restablecer mi contraseña</a>
            </div>
            
            <div class="warning">
              <p style="margin: 0;"><strong>⚠️ Importante:</strong></p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Este código es válido por <strong>1 hora</strong></li>
                <li>Si no solicitaste este cambio, ignora este email</li>
                <li>Tu contraseña actual sigue siendo válida hasta que la cambies</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>© 2025 SubiteYa - Automatiza tus publicaciones en TikTok</p>
            <p>Este email fue enviado a ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
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
  const mailOptions = {
    from: `"SubiteYa" <${process.env.EMAIL_USER || 'subiteyacontact@gmail.com'}>`,
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
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de bienvenida enviado a: ${email}`);
  } catch (error) {
    console.error('❌ Error al enviar email de bienvenida:', error);
    // No throw error here, welcome email is not critical
  }
}
