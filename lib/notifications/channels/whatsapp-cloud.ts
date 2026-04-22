import type { WhatsAppCloudConfig, RenderedMessage } from '../types';
import type { Locale } from '@/lib/i18n/config';

const META_LANG_MAP: Record<Locale, string> = {
  fr: 'fr',
  en: 'en',
};

export async function sendWhatsAppCloud(
  config: WhatsAppCloudConfig,
  message: RenderedMessage,
  locale?: Locale,
): Promise<void> {
  const url = `https://graph.facebook.com/v17.0/${config.phone_number_id}/messages`;

  const templateName = resolveTemplateName(config, locale);
  const langCode = locale ? META_LANG_MAP[locale] : config.template_lang;

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
        name: templateName,
        language: { code: langCode },
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

function resolveTemplateName(config: WhatsAppCloudConfig, locale: Locale | undefined): string {
  if (!locale) return config.template_name;

  if (locale === 'fr' && config.template_name_fr) return config.template_name_fr;
  if (locale === 'en' && config.template_name_en) return config.template_name_en;

  return config.template_name;
}
