import 'server-only';
import type { RenderedMessage } from '../types';

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

export async function buildInvitationMessage(
  params: {
    inviteUrl: string
    role: 'admin' | 'professional'
    invitedByEmail: string
    expiresAt: Date
    shopName: string
  }
): Promise<RenderedMessage> {
  const { inviteUrl, role, invitedByEmail, expiresAt, shopName } = params;

  const roleLabel = role === 'admin' ? 'Administrator' : 'Professional';
  const expiresAtStr = expiresAt.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject = `You have been invited to join ${shopName}`;

  const heading = `You're invited to join ${shopName}`;

  const plainText = [
    `Hello,`,
    ``,
    `You have been invited to become a ${roleLabel} at ${shopName}.`,
    ``,
    `This invitation was sent by: ${invitedByEmail}`,
    ``,
    `Accept your invitation by clicking the link below:`,
    `${inviteUrl}`,
    ``,
    `This invitation expires on: ${expiresAtStr}`,
    ``,
    `If you did not expect this invitation, you can safely ignore this email.`,
  ].join('\n');

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
      <div style="background: #ffffff; border-radius: 8px; padding: 24px; border: 1px solid #e0e0e0;">
        <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 20px;">${heading}</h2>
        <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.6;">
          You have been invited to become a <strong>${roleLabel}</strong> at <strong>${shopName}</strong>.
        </p>
        <p style="margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.6;">
          This invitation was sent by: <strong>${invitedByEmail}</strong>
        </p>
        <div style="margin: 24px 0; text-align: center;">
          <a href="${inviteUrl}" style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
            Accept Invitation
          </a>
        </div>
        <p style="margin: 0; color: #888; font-size: 12px;">
          This invitation expires on: ${expiresAtStr}
        </p>
        <p style="margin: 16px 0 0; color: #888; font-size: 12px;">
          If you did not expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  return {
    subject,
    plainText,
    html,
    telegramHtml: `<b>${heading}</b>\n\nYou have been invited to become a ${roleLabel} at ${shopName}.\n\n<a href="${inviteUrl}">Accept Invitation</a>\n\nExpires: ${expiresAtStr}`,
    whatsAppCloudParams: [
      roleLabel,
      shopName,
      invitedByEmail,
      expiresAtStr,
    ],
  };
}