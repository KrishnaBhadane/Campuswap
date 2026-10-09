import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';

let transport;

export async function sendVerificationEmail(email, code) {
  email = email.trim().toLowerCase();
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid verification code format');
  if (!transport) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
    const port = Number(SMTP_PORT);
    if (!SMTP_HOST || !MAIL_FROM || !Number.isInteger(port) || port < 1 || port > 65535 || Boolean(SMTP_USER) !== Boolean(SMTP_PASS)) {
      throw new Error('SMTP configuration is incomplete');
    }
    const local = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '::1'].includes(SMTP_HOST);
    transport = nodemailer.createTransport({
      host: SMTP_HOST, port, secure: port === 465, requireTLS: !local,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, dnsTimeout: 10000,
      disableFileAccess: true, disableUrlAccess: true
    });
  }
  const address = process.env.MAIL_FROM;
  const from = { name: 'CampusSwap', address: address.match(/<([^>]+)>/)?.[1] || address.trim() };
  const subject = `CampusSwap verification code ${randomUUID()}`;
  try {
    const result = await transport.sendMail({
      from, to: { address: email }, subject,
      text: `CampusSwap\n\nYour verification code is:\n${code}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.`,
      html: `<h2>CampusSwap</h2><p>Your verification code is:</p><p><strong>${code}</strong></p><p>This code expires in 10 minutes.</p><p>If you did not request this, ignore this email.</p>`
    });
    if (!result.accepted?.includes(email)) throw new Error('Email was not accepted by SMTP');
  } catch (error) {
    let message = String(error.response || error.message);
    for (const secret of [process.env.SMTP_PASS, process.env.SMTP_USER, process.env.MAIL_FROM, process.env.JWT_SECRET, code]) {
      if (secret) message = message.split(secret).join('[redacted]');
    }
    message = message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/gi, '[email]').replace(/[\r\n]+/g, ' ').slice(0, 1000);
    console.error('SMTP delivery failed:', { code: error.code, responseCode: error.responseCode, message });
    throw error;
  }
}
