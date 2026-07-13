import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Thin wrapper around nodemailer. SMTP is configured entirely through env vars
 * (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM) so the same code
 * works with any provider — Gmail / Google Workspace, Zoho, Office365, etc.
 *
 * When SMTP is not configured (e.g. local dev) we LOG the message instead of
 * throwing, so every email-bearing flow can still be exercised end-to-end
 * without a mail server. Look for the `[DEV]` lines in the backend console.
 *
 * Logos are embedded as CID inline attachments (not remote <img src>), because
 * Gmail/Outlook proxy or block remote images by default — a CID attachment
 * travels inside the message and always renders. The PNGs live in
 * `src/mail/assets/` and are copied into `dist/mail/assets/` by nest-cli.json,
 * so we resolve them relative to __dirname (the running file), not the source.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {}

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing) — emails will be logged, not sent.',
      );
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS/SSL; 587 or 25 = STARTTLS
      auth: { user, pass },
    });
    return this.transporter;
  }

  private fromAddress(): string {
    return (
      this.config.get<string>('MAIL_FROM') ??
      this.config.get<string>('SMTP_USER') ??
      'noreply@rgbindia.com'
    );
  }

  /** Absolute sign-in URL used in emails. Falls back to CORS_ORIGIN / localhost. */
  private loginUrl(): string {
    const base =
      this.config.get<string>('FRONTEND_URL') ??
      this.config.get<string>('CORS_ORIGIN') ??
      'http://localhost:3000';
    return `${base.replace(/\/$/, '')}/login`;
  }

  private firstNameOf(name?: string): string {
    return (name || '').trim().split(/\s+/)[0] || 'there';
  }

  // ── Password reset ──────────────────────────────────────────────────────────

  async sendPasswordResetOtp(to: string, otp: string): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(`[DEV] Password-reset OTP for ${to}: ${otp} (SMTP not configured)`);
      return;
    }

    try {
      await transporter.sendMail({
        from: `V2E <${this.fromAddress()}>`,
        to,
        subject: 'Your V2E password reset code',
        text:
          `Password reset request\n\n` +
          `We received a request to reset the password for your V2E account.\n` +
          `Enter this code to continue:\n\n` +
          `        ${otp}\n\n` +
          `This code expires in 10 minutes. Please don't share it with anyone —\n` +
          `V2E will never ask you for this code.\n\n` +
          `If you didn't request a password reset, you can safely ignore this\n` +
          `email and your password will stay the same.\n\n` +
          `—\n` +
          `V2E · The operating system for your organisation\n` +
          `Sent by RGB India · Automated message, please do not reply.`,
        html: this.resetHtml(otp),
        attachments: this.logoAttachments(),
      });
      this.logger.log(`Password-reset OTP sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send password-reset OTP to ${to}`, err as Error);
      throw err;
    }
  }

  // ── Welcome (account provisioned by an admin) ───────────────────────────────

  /**
   * Sent when a NEW account is created for someone by an admin/super-admin —
   * carries the firm name and the exact sign-in credentials they were given.
   */
  async sendWelcomeCredentials(params: {
    to: string;
    name: string;
    firmName: string;
    password: string;
  }): Promise<void> {
    const { to, name, firmName, password } = params;
    const transporter = this.getTransporter();
    const firstName = this.firstNameOf(name);

    if (!transporter) {
      this.logger.warn(
        `[DEV] Welcome credentials for ${to} @ "${firmName}" — email: ${to}, password: ${password} (SMTP not configured)`,
      );
      return;
    }

    try {
      await transporter.sendMail({
        from: `V2E <${this.fromAddress()}>`,
        to,
        subject: `Your V2E account for ${firmName} is ready`,
        text:
          `Welcome to V2E, ${firstName}\n\n` +
          `An account has been created for you on V2E — the operating system ` +
          `${firmName} uses to run its work: tasks, projects, goals, tickets and ` +
          `more, all in one place.\n\n` +
          `Here are your sign-in details:\n\n` +
          `    Organisation:  ${firmName}\n` +
          `    Sign-in link:  ${this.loginUrl()}\n` +
          `    Email:         ${to}\n` +
          `    Password:      ${password}\n\n` +
          `For your security, please sign in and change your password after your\n` +
          `first login. Keep these details private — V2E will never ask you for\n` +
          `your password by email.\n\n` +
          `If you weren't expecting this, please contact your administrator.\n\n` +
          `—\n` +
          `V2E · The operating system for your organisation\n` +
          `Sent by RGB India · Automated message, please do not reply.`,
        html: this.welcomeHtml(firstName, firmName, to, password),
        attachments: this.logoAttachments(),
      });
      this.logger.log(`Welcome credentials email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send welcome credentials email to ${to}`, err as Error);
      throw err;
    }
  }

  /**
   * Sent when an EXISTING V2E user is added to another firm — no credentials
   * (we don't have or want their password); just points them to sign in.
   */
  async sendAddedToFirm(params: {
    to: string;
    name: string;
    firmName: string;
  }): Promise<void> {
    const { to, name, firmName } = params;
    const transporter = this.getTransporter();
    const firstName = this.firstNameOf(name);

    if (!transporter) {
      this.logger.warn(`[DEV] "Added to ${firmName}" notice for existing user ${to} (SMTP not configured)`);
      return;
    }

    try {
      await transporter.sendMail({
        from: `V2E <${this.fromAddress()}>`,
        to,
        subject: `You've been added to ${firmName} on V2E`,
        text:
          `Hello ${firstName},\n\n` +
          `You've been added to ${firmName} on V2E. Sign in with your existing\n` +
          `V2E account to get started:\n\n` +
          `    ${this.loginUrl()}\n\n` +
          `If you've forgotten your password, use "Forgot password" on the\n` +
          `sign-in page to reset it.\n\n` +
          `—\n` +
          `V2E · The operating system for your organisation\n` +
          `Sent by RGB India · Automated message, please do not reply.`,
        html: this.addedToFirmHtml(firstName, firmName),
        attachments: this.logoAttachments(),
      });
      this.logger.log(`"Added to firm" email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send "added to firm" email to ${to}`, err as Error);
      throw err;
    }
  }

  // ── CID inline attachments ──────────────────────────────────────────────────

  /** Inline logo attachments (CID), silently skipping any file that isn't bundled. */
  private logoAttachments() {
    const dir = path.join(__dirname, 'assets');
    return [
      { filename: 'v2e-logo.png', cid: 'v2eLogo' },
      { filename: 'rgb-logo.png', cid: 'rgbLogo' },
    ]
      .map((a) => ({ ...a, full: path.join(dir, a.filename) }))
      .filter((a) => fs.existsSync(a.full))
      .map((a) => ({ filename: a.filename, path: a.full, cid: a.cid }));
  }

  // ── Shared HTML building blocks (inline CSS only; table layout) ──────────────

  private headerBlock(): string {
    return `
        <div style="padding:28px 36px 8px;text-align:center;">
          <img src="cid:v2eLogo" width="46" height="46" alt="V2E" style="display:inline-block;border:0;border-radius:11px;" />
          <div style="margin-top:10px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#0F172A;">V2E</div>
        </div>`;
  }

  private otpBlock(otp: string): string {
    return `
          <div style="text-align:center;margin:8px 0 14px;">
            <div style="display:inline-block;padding:16px 30px;border-radius:12px;background:#EFF6FF;border:1px solid #BFDBFE;font-size:34px;font-weight:800;letter-spacing:9px;color:#2563EB;font-family:'SF Mono','Consolas','Fira Code',monospace;">
              ${otp}
            </div>
          </div>
          <p style="margin:0 0 22px;font-size:12.5px;line-height:1.6;color:#94A3B8;text-align:center;">
            This code expires in 10 minutes.
          </p>`;
  }

  /** A boxed credentials table + a primary "Sign in" button. */
  private credentialsBlock(firmName: string, email: string, password: string): string {
    const row = (label: string, value: string, mono = false) => `
              <tr>
                <td style="padding:9px 0;font-size:13px;color:#64748B;width:120px;vertical-align:top;">${label}</td>
                <td style="padding:9px 0;font-size:14px;color:#0F172A;font-weight:600;${
                  mono ? "font-family:'SF Mono','Consolas','Fira Code',monospace;" : ''
                }">${value}</td>
              </tr>`;
    return `
          <div style="margin:4px 0 18px;padding:6px 20px;border:1px solid #E2E8F0;border-radius:12px;background:#F8FAFC;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${row('Organisation', firmName)}
              ${row('Email', email, true)}
              ${row('Password', password, true)}
            </table>
          </div>
          <div style="text-align:center;margin:6px 0 20px;">
            <a href="${this.loginUrl()}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:#2563EB;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;">
              Sign in to V2E
            </a>
          </div>
          <p style="margin:0 0 22px;font-size:12.5px;line-height:1.6;color:#94A3B8;text-align:center;">
            For your security, please change your password after your first sign-in.
          </p>`;
  }

  private ctaButton(label: string): string {
    return `
          <div style="text-align:center;margin:10px 0 22px;">
            <a href="${this.loginUrl()}" style="display:inline-block;padding:12px 28px;border-radius:10px;background:#2563EB;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;">
              ${label}
            </a>
          </div>`;
  }

  private footerBlock(): string {
    return `
          <div style="border-top:1px solid #E2E8F0;padding-top:20px;margin-top:4px;">
            <p style="margin:0 0 10px;font-size:12.5px;line-height:1.6;color:#64748B;">
              <strong style="color:#0F172A;">V2E</strong> · The operating system for your organisation
            </p>
            <p style="margin:0 0 12px;font-size:11px;line-height:1.6;color:#94A3B8;">
              Sent by RGB India · Automated message, please do not reply.
            </p>
            <img src="cid:rgbLogo" width="88" alt="RGB — Business Growth Consulting" style="display:block;border:0;height:auto;" />
          </div>`;
  }

  private shell(inner: string, disclaimer: string): string {
    return `
    <div style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
        ${this.headerBlock()}
        <div style="padding:8px 36px 30px;">
          ${inner}
        </div>
      </div>
      <p style="max-width:480px;margin:16px auto 0;font-size:11.5px;line-height:1.6;color:#94A3B8;text-align:center;">
        ${disclaimer}
      </p>
    </div>`;
  }

  private resetHtml(otp: string): string {
    const inner = `
          <h1 style="margin:14px 0 12px;font-size:23px;line-height:1.3;color:#0F172A;font-weight:800;letter-spacing:-0.01em;text-align:center;">
            Password reset request
          </h1>
          <p style="margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#334155;text-align:center;">
            We received a request to reset the password for your V2E account. Enter this code to continue:
          </p>
          ${this.otpBlock(otp)}
          <p style="margin:0 0 22px;font-size:13.5px;line-height:1.7;color:#334155;text-align:center;">
            Please don't share it with anyone — <strong>V2E will never ask you for this code.</strong>
          </p>
          ${this.footerBlock()}`;
    return this.shell(
      inner,
      "If you didn't request a password reset, you can safely ignore this email — your password won't change.",
    );
  }

  private welcomeHtml(firstName: string, firmName: string, email: string, password: string): string {
    const inner = `
          <h1 style="margin:14px 0 14px;font-size:23px;line-height:1.3;color:#0F172A;font-weight:800;letter-spacing:-0.01em;">
            Welcome to V2E, ${firstName}
          </h1>
          <p style="margin:0 0 18px;font-size:14.5px;line-height:1.7;color:#334155;">
            An account has been created for you on <strong>V2E</strong> — the operating system <strong>${firmName}</strong> uses to run its work: tasks, projects, goals, tickets and more, all in one place.
          </p>
          <p style="margin:0 0 12px;font-size:13.5px;line-height:1.7;color:#334155;">
            Here are your sign-in details:
          </p>
          ${this.credentialsBlock(firmName, email, password)}
          <p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:#64748B;">
            Keep these details private — V2E will never ask you for your password by email. If you weren't expecting this, please contact your administrator.
          </p>
          ${this.footerBlock()}`;
    return this.shell(inner, "If you weren't expecting a V2E account, you can safely ignore this email.");
  }

  private addedToFirmHtml(firstName: string, firmName: string): string {
    const inner = `
          <h1 style="margin:14px 0 14px;font-size:23px;line-height:1.3;color:#0F172A;font-weight:800;letter-spacing:-0.01em;">
            You've been added to ${firmName}
          </h1>
          <p style="margin:0 0 8px;font-size:14.5px;line-height:1.7;color:#334155;">
            Hello ${firstName}, you now have access to <strong>${firmName}</strong> on V2E. Sign in with your existing V2E account to get started.
          </p>
          ${this.ctaButton('Sign in to V2E')}
          <p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:#64748B;text-align:center;">
            Forgot your password? Use <strong>“Forgot password”</strong> on the sign-in page to reset it.
          </p>
          ${this.footerBlock()}`;
    return this.shell(inner, "If you weren't expecting this, you can safely ignore this email.");
  }
}
