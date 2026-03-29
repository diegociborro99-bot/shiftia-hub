const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ====== EMAIL CONFIG ======
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'highkeycvsender@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || ''
  }
});

// ====== RATE LIMITING ======
const rateLimit = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const attempts = rateLimit.get(ip) || [];
  const recent = attempts.filter(t => now - t < 60000); // 1 minute window
  rateLimit.set(ip, recent);
  if (recent.length >= 3) return true; // Max 3 per minute
  recent.push(now);
  rateLimit.set(ip, recent);
  return false;
}

// ====== CONTACT FORM API ======
app.post('/api/contact', async (req, res) => {
  try {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    if (isRateLimited(clientIP)) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
    }

    const { name, email, company, workers, department, message } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son obligatorios' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email no valido' });
    }

    // Sanitize HTML to prevent XSS in emails
    const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeName = esc(name);
    const safeEmail = esc(email);
    const safeCompany = esc(company);
    const safeWorkers = esc(workers);
    const safeDepartment = esc(department);
    const safeMessage = esc(message);

    // 1. Send notification to Shiftia team
    await transporter.sendMail({
      from: `"Shiftia HUB" <${process.env.GMAIL_USER || 'highkeycvsender@gmail.com'}>`,
      to: 'highkeycvsender@gmail.com',
      subject: `Nueva solicitud de demo — ${safeName} (${safeCompany || 'Sin empresa'})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <div style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.4rem;">Nueva solicitud de demo</h1>
          </div>
          <div style="background: #f8fafc; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 140px;">Nombre</td><td style="padding: 10px 0; color: #1e293b;">${safeName}</td></tr>
              <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Email</td><td style="padding: 10px 0;"><a href="mailto:${safeEmail}" style="color: #2980b9;">${safeEmail}</a></td></tr>
              ${safeCompany ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Empresa</td><td style="padding: 10px 0; color: #1e293b;">${safeCompany}</td></tr>` : ''}
              ${safeWorkers ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Trabajadores</td><td style="padding: 10px 0; color: #1e293b;">${safeWorkers}</td></tr>` : ''}
              ${safeDepartment ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Departamento</td><td style="padding: 10px 0; color: #1e293b;">${safeDepartment}</td></tr>` : ''}
            </table>
            ${safeMessage ? `
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-weight: 600; margin-bottom: 8px;">Mensaje:</p>
                <p style="color: #1e293b; line-height: 1.6; background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">${safeMessage}</p>
              </div>
            ` : ''}
            <p style="color: #94a3b8; font-size: 0.82rem; margin-top: 24px;">Enviado desde www.shiftia.es — ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
          </div>
        </div>
      `
    });

    // 2. Send confirmation to the client
    await transporter.sendMail({
      from: `"Shiftia" <${process.env.GMAIL_USER || 'highkeycvsender@gmail.com'}>`,
      to: email,
      subject: 'Hemos recibido tu solicitud — Shiftia',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <div style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 1.5rem;">Shiftia</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1e293b; margin-top: 0;">Hola ${safeName.split(' ')[0]},</h2>
            <p style="color: #475569; line-height: 1.7;">Hemos recibido tu solicitud correctamente. Nuestro equipo la revisara y te contactaremos en <strong>menos de 24 horas laborables</strong> con una propuesta personalizada.</p>
            <p style="color: #475569; line-height: 1.7;">Mientras tanto, si tienes cualquier duda, puedes responder a este email directamente.</p>
            <div style="margin: 28px 0; padding: 20px; background: #f0fdf9; border-radius: 8px; border-left: 4px solid #4ecdc4;">
              <p style="color: #1e293b; margin: 0; font-weight: 600;">Lo que incluye tu demo:</p>
              <ul style="color: #475569; line-height: 1.8; padding-left: 20px;">
                <li>Configuracion con los datos de tu equipo</li>
                <li>Demo en vivo del motor IA de coberturas</li>
                <li>30 dias de prueba gratuita sin compromiso</li>
              </ul>
            </div>
            <p style="color: #475569;">Un saludo,<br><strong>El equipo de Shiftia</strong></p>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 0.78rem; margin-top: 20px;">www.shiftia.es</p>
        </div>
      `
    });

    console.log(`Contact form: ${name} <${email}> — ${company || 'N/A'}`);
    res.json({ ok: true });

  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ error: 'Error al enviar. Intentalo de nuevo.' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.1.0' });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Shiftia HUB v1.1 running on port ${PORT}`);
});
