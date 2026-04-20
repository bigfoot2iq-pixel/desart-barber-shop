import type { WhatsAppCloudConfig, RenderedMessage } from '../types';

// Expected Meta template variable order (must match approved template):
// {{1}} Customer name
// {{2}} Date
// {{3}} Time
// {{4}} Services
// {{5}} Location type (Salon / Come to Home)
// {{6}} Payment info
//
// When approving the template in Meta, use:
// {{1}}
// {{2}}
// {{3}}
// {{4}}
// {{5}}
// {{6}}

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
            parameters: message.whatsAppCloudParams.map((text) => ({
              type: 'text',
              text,
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
