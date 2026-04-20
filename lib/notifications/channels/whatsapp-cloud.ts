import type { WhatsAppCloudConfig, RenderedMessage } from '../types';

export async function sendWhatsAppCloud(config: WhatsAppCloudConfig, message: RenderedMessage): Promise<void> {
  const url = `https://graph.facebook.com/v17.0/${config.phone_number_id}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: config.to,
      type: 'template',
      template: {
        name: config.template_name,
        language: { code: config.template_lang },
        components: [
          {
            type: 'body',
            parameters: message.plainText.split('\n').map((line) => ({
              type: 'text',
              text: line,
            })),
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp Cloud API error: ${res.status} ${body}`);
  }
}
