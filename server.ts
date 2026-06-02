import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize transporter globally to reuse connections
let globalTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (globalTransporter) return globalTransporter;

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || (process.env.SMTP_SECURE === undefined && smtpPort === 465);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  globalTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    // Add timeout to avoid hanging
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    // Pool connections for better performance with multiple emails
    pool: true,
    maxConnections: 5,
    maxMessages: 100
  });

  return globalTransporter;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Email sending endpoint
  app.post('/api/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Configure transporter
    const smtpFrom = process.env.SMTP_FROM?.trim() || 'no-reply@xcelerate.com';
    const transporter = getTransporter();

    if (!transporter) {
      console.log(`[SMTP Mock] To: ${to}, Subject: ${subject}`);
      return res.json({ success: true, message: 'Email logged (SMTP not configured)' });
    }

    try {
      await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        text,
        html,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
  });

  // API to resolve Google Drive direct download URL bypassing virus scan (removed due to reliability issues)
  
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the 'dist' directory
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Handle SPA routing: redirect all non-API requests to index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
