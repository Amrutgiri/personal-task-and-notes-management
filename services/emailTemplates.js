const YEAR = new Date().getFullYear();

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const FONT = "'Inter','Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

/**
 * Password reset email — table-based layout (Outlook/Gmail safe), fully inline styles.
 */
const passwordResetEmail = ({ to, name, resetUrl, expiresInMinutes }) => {
  const safeName = escapeHtml(name || 'there');
  const safeEmail = escapeHtml(to);
  const safeUrl = escapeHtml(resetUrl);
  const minutes = Number(expiresInMinutes) || 30;

  const subject = 'Reset your ZenNotes password';

  const text = [
    `Hi ${name || 'there'},`,
    '',
    'We received a request to reset the password for your ZenNotes account.',
    '',
    `Open this link to choose a new password (valid for ${minutes} minutes):`,
    resetUrl,
    '',
    'The link can only be used once. If it expires, simply request a new one from the sign-in page.',
    '',
    `If you did not request a password reset, you can safely ignore this email — your password will not change.`,
    '',
    `— ZenNotes | Personal Task & Notes Management`,
    `Sent to ${to}`
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:36px 16px;">

        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 30px -18px rgba(15,23,42,0.35);font-family:${FONT};">

          <!-- Brand header -->
          <tr>
            <td style="background-color:#4338ca;background-image:linear-gradient(135deg,#4f46e5 0%,#4338ca 55%,#312e81 100%);padding:26px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:40px;height:40px;border-radius:12px;background-color:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.28);text-align:center;vertical-align:middle;font-size:19px;line-height:40px;font-weight:700;color:#ffffff;">Z</td>
                  <td style="padding-left:12px;font-size:19px;font-weight:700;letter-spacing:-0.4px;color:#ffffff;vertical-align:middle;">ZenNotes</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent strip -->
          <tr>
            <td style="height:4px;background-color:#6366f1;background-image:linear-gradient(90deg,#6366f1,#8b5cf6 45%,#06b6d4);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:34px 36px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom:16px;">
                    <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#4f46e5;background-color:rgba(79,70,229,0.09);border:1px solid rgba(79,70,229,0.2);border-radius:999px;padding:5px 12px;">
                      Account security
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:24px;line-height:1.25;font-weight:700;color:#0f172a;letter-spacing:-0.5px;padding-bottom:14px;">
                    Reset your password
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.65;color:#475569;padding-bottom:10px;">
                    Hi ${safeName},
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.65;color:#475569;padding-bottom:24px;">
                    We received a request to reset the password for
                    <strong style="color:#0f172a;">${safeEmail}</strong>.
                    Choose a new one using the secure button below.
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:26px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:#4f46e5;border-radius:10px;mso-padding-alt:14px 30px;">
                          <a href="${safeUrl}"
                             style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#4f46e5;">
                            Reset my password
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry / security note -->
          <tr>
            <td style="padding:0 36px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:#64748b;">
                    <strong style="color:#334155;">Link expires in ${minutes} minutes</strong> and can be used only once.
                    For your security, changing your password will sign you out of all devices.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:0 36px 8px;font-family:${FONT};font-size:12px;color:#94a3b8;padding-bottom:8px;">
              Button not working? Copy and paste this link into your browser:
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 26px;">
              <div style="font-family:${MONO};font-size:12px;line-height:1.6;color:#4f46e5;background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:12px 14px;word-break:break-all;">
                ${safeUrl}
              </div>
            </td>
          </tr>

          <!-- Ignore note -->
          <tr>
            <td style="padding:0 36px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #f59e0b;background-color:#fffbeb;border-radius:0 10px 10px 0;">
                <tr>
                  <td style="padding:12px 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:#92400e;">
                    Didn’t request this? You can safely ignore this email — your password will not change.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:22px 36px;font-family:${FONT};text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-size:13px;font-weight:700;color:#334155;padding-bottom:6px;">ZenNotes</td>
                </tr>
                <tr>
                  <td style="font-size:12px;line-height:1.7;color:#94a3b8;">
                    Personal Task &amp; Notes Management<br>
                    You received this email because a password reset was requested for ${safeEmail}.<br>
                    &copy; ${YEAR} ZenNotes. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!--[if mso]>
        </td></tr></table>
        <![endif]-->

      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
};

/**
 * Admin-initiated password reset email — same table-based layout as the
 * self-service reset, but with an emerald accent and admin wording.
 */
const adminPasswordResetEmail = ({ to, name, adminName, resetUrl, expiresInMinutes }) => {
  const safeName = escapeHtml(name || 'there');
  const safeEmail = escapeHtml(to);
  const safeAdmin = escapeHtml(adminName || 'An administrator');
  const safeUrl = escapeHtml(resetUrl);
  const minutes = Number(expiresInMinutes) || 30;

  const subject = 'Your ZenNotes password was reset by an administrator';

  const text = [
    `Hi ${name || 'there'},`,
    '',
    `${adminName || 'An administrator'} sent you a secure link to reset your ZenNotes password.`,
    '',
    `Open this link to choose a new password (valid for ${minutes} minutes):`,
    resetUrl,
    '',
    'The link can only be used once. If it expires, ask your administrator to send a new one.',
    '',
    `If you were not expecting this email, you can safely ignore it — your password will not change.`,
    '',
    `— ZenNotes | Personal Task & Notes Management`,
    `Sent to ${to}`
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:36px 16px;">

        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 30px -18px rgba(15,23,42,0.35);font-family:${FONT};">

          <!-- Brand header -->
          <tr>
            <td style="background-color:#065f46;background-image:linear-gradient(135deg,#059669 0%,#047857 55%,#064e3b 100%);padding:26px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:40px;height:40px;border-radius:12px;background-color:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.28);text-align:center;vertical-align:middle;font-size:19px;line-height:40px;font-weight:700;color:#ffffff;">Z</td>
                  <td style="padding-left:12px;font-size:19px;font-weight:700;letter-spacing:-0.4px;color:#ffffff;vertical-align:middle;">ZenNotes</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent strip -->
          <tr>
            <td style="height:4px;background-color:#10b981;background-image:linear-gradient(90deg,#10b981,#34d399 45%,#06b6d4);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:34px 36px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom:16px;">
                    <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#047857;background-color:rgba(5,150,105,0.09);border:1px solid rgba(5,150,105,0.2);border-radius:999px;padding:5px 12px;">
                      Administrator action
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:24px;line-height:1.25;font-weight:700;color:#0f172a;letter-spacing:-0.5px;padding-bottom:14px;">
                    Reset your password
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.65;color:#475569;padding-bottom:10px;">
                    Hi ${safeName},
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.65;color:#475569;padding-bottom:24px;">
                    <strong style="color:#0f172a;">${safeAdmin}</strong> sent a password reset request for
                    <strong style="color:#0f172a;">${safeEmail}</strong>.
                    Choose a new password using the secure button below.
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:26px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:#059669;border-radius:10px;mso-padding-alt:14px 30px;">
                          <a href="${safeUrl}"
                             style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#059669;">
                            Set a new password
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry / security note -->
          <tr>
            <td style="padding:0 36px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:#64748b;">
                    <strong style="color:#334155;">Link expires in ${minutes} minutes</strong> and can be used only once.
                    Changing your password will sign you out of all devices.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:0 36px 8px;font-family:${FONT};font-size:12px;color:#94a3b8;padding-bottom:8px;">
              Button not working? Copy and paste this link into your browser:
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 26px;">
              <div style="font-family:${MONO};font-size:12px;line-height:1.6;color:#047857;background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:12px 14px;word-break:break-all;">
                ${safeUrl}
              </div>
            </td>
          </tr>

          <!-- Ignore note -->
          <tr>
            <td style="padding:0 36px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #f59e0b;background-color:#fffbeb;border-radius:0 10px 10px 0;">
                <tr>
                  <td style="padding:12px 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:#92400e;">
                    Not expecting this? You can safely ignore this email — your password will not change.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:22px 36px;font-family:${FONT};text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-size:13px;font-weight:700;color:#334155;padding-bottom:6px;">ZenNotes</td>
                </tr>
                <tr>
                  <td style="font-size:12px;line-height:1.7;color:#94a3b8;">
                    Personal Task &amp; Notes Management<br>
                    You received this email because an administrator requested a password reset for ${safeEmail}.<br>
                    &copy; ${YEAR} ZenNotes. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!--[if mso]>
        </td></tr></table>
        <![endif]-->

      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
};

module.exports = {
  passwordResetEmail,
  adminPasswordResetEmail
};
