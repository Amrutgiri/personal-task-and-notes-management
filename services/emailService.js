const nodemailer = require('nodemailer');
const { passwordResetEmail, adminPasswordResetEmail } = require('./emailTemplates');

const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

/**
 * Sends the password-reset email.
 * Throws on failure so the caller can decide what to do.
 */
const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresInMinutes }) => {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const transport = getTransport();
  const { subject, text, html } = passwordResetEmail({ to, name, resetUrl, expiresInMinutes });

  await transport.sendMail({
    from: `"ZenNotes" <${from}>`,
    to,
    subject,
    text,
    html
  });
};

/**
 * Sends the admin-initiated password reset email.
 * Throws on failure so the caller can decide what to do.
 */
const sendAdminPasswordResetEmail = async ({ to, name, adminName, resetUrl, expiresInMinutes }) => {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const transport = getTransport();
  const { subject, text, html } = adminPasswordResetEmail({ to, name, adminName, resetUrl, expiresInMinutes });

  await transport.sendMail({
    from: `"ZenNotes" <${from}>`,
    to,
    subject,
    text,
    html
  });
};

/**
 * Verifies the SMTP connection (used by scripts / health checks).
 */
const verifyConnection = async () => {
  await getTransport().verify();
};

module.exports = {
  isEmailConfigured,
  sendPasswordResetEmail,
  sendAdminPasswordResetEmail,
  verifyConnection
};
