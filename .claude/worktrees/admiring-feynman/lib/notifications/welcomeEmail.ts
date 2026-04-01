/**
 * Welcome email builder for newly approved company registrations.
 * Sends login credentials to each user after superadmin approves the registration.
 */

export function buildWelcomeEmail(params: {
  userName: string;
  email: string;
  tempPassword: string;
  companyName: string;
  loginUrl: string;
}) {
  const { userName, email, tempPassword, companyName, loginUrl } = params;

  const subject = `Welcome to Travel CMS — Your account is ready`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;background:#ffffff">
  <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#ffffff;margin:0;font-size:24px">Welcome to Travel CMS</h1>
    <p style="color:#e9d5ff;margin:8px 0 0;font-size:14px">${companyName}</p>
  </div>

  <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="font-size:16px;margin:0 0 16px">Hi ${userName},</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px">
      Your company <strong>${companyName}</strong> has been approved and your account is ready to use.
      Below are your login credentials:
    </p>

    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280;width:100px">Email</td>
          <td style="padding:6px 0;font-size:14px;font-weight:600">${email}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280">Password</td>
          <td style="padding:6px 0;font-size:14px;font-family:monospace;font-weight:600;letter-spacing:0.5px">${tempPassword}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="${loginUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Log in to Travel CMS
      </a>
    </div>

    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 16px">
      <p style="font-size:13px;color:#92400e;margin:0">
        <strong>Important:</strong> Please change your password after your first login.
        Go to Settings → Profile → Change Password.
      </p>
    </div>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
    <p style="font-size:12px;color:#9ca3af;margin:0;text-align:center">
      This email was sent automatically by Travel CMS. If you did not request this account, please ignore this email.
    </p>
  </div>
</div>`;

  const text = `Welcome to Travel CMS — ${companyName}

Hi ${userName},

Your company has been approved. Here are your login credentials:

Email: ${email}
Password: ${tempPassword}

Login: ${loginUrl}

Please change your password after your first login (Settings → Profile → Change Password).`;

  return { subject, html, text };
}
