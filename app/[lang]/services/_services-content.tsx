'use client';

import Link from 'next/link';
import { DictionaryProvider, useT } from '@/lib/i18n/client-dictionary';
import type { Locale } from '@/lib/i18n/config';
import type { Service } from '@/lib/types/database';

interface ServicesContentProps {
  locale: Locale;
  common: Record<string, unknown>;
  booking: Record<string, unknown>;
  services: Service[];
}

function FAQ() {
  const t = useT('common');
  const faqs = ['q1', 'q2', 'q3'] as const;

  return (
    <section className="bg-brand-black text-brand-white py-20 px-4">
      <div className="max-w-[720px] mx-auto">
        <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-center mb-14">
          {t('servicesPage.faq.title')}
        </h2>
        <div className="flex flex-col gap-6">
          {faqs.map((q) => (
            <div key={q} className="bg-[rgb(254_251_243/5%)] rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-2">{t(`servicesPage.faq.${q}.question`)}</h3>
              <p className="text-sm text-[rgb(254_251_243/60%)] leading-relaxed">{t(`servicesPage.faq.${q}.answer`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServicesContent({ locale, common, booking, services }: ServicesContentProps) {
  const t = useT('common');
  const lang = locale;

  return (
    <DictionaryProvider value={{ common, booking }}>
      <main>
        {/* Hero */}
        <section className="bg-brand-black text-brand-white py-20 px-4">
          <div className="max-w-[800px] mx-auto text-center">
            <span className="inline-block text-gold3 text-xs font-semibold tracking-[0.2em] uppercase mb-6">
              {t('servicesPage.hero.eyebrow')}
            </span>
            <h1 className="font-playfair text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              {t('servicesPage.hero.title')}
            </h1>
            <p className="text-xl sm:text-2xl text-[rgb(254_251_243/70%)] mb-4 font-light">
              {t('servicesPage.hero.subtitle')}
            </p>
            <p className="text-base text-[rgb(254_251_243/50%)] max-w-lg mx-auto leading-relaxed">
              {t('servicesPage.hero.description')}
            </p>
          </div>
        </section>

        {/* Services Grid */}
        <section className="bg-gold-bg text-brand-black py-20 px-4">
          <div className="max-w-[960px] mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map((service) => (
                <div key={service.id} className="bg-white rounded-xl p-6 border border-[rgb(10_8_0/8%)] shadow-sm hover:shadow-md transition-shadow duration-200">
                  <h3 className="font-semibold text-lg mb-2">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-[rgb(10_8_0/55%)] mb-4 leading-relaxed">{service.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-[rgb(10_8_0/8%)]">
                    <span className="text-gold3 font-bold text-lg">{service.price_mad} MAD</span>
                    <span className="text-xs text-[rgb(10_8_0/45%)]">{service.duration_minutes} min</span>
                  </div>
                </div>
              ))}
            </div>

            {services.length === 0 && (
              <p className="text-center text-[rgb(10_8_0/50%)] py-12">
                {locale === 'fr' ? 'Aucun service disponible pour le moment.' : 'No services available at the moment.'}
              </p>
            )}
          </div>
        </section>

        {/* FAQ */}
        <FAQ />

        {/* CTA */}
        <section className="bg-gold-bg text-brand-black py-20 px-4 text-center">
          <div className="max-w-[600px] mx-auto">
            <h2 className="font-playfair text-3xl sm:text-4xl font-bold mb-8">
              {t('servicesPage.cta.title')}
            </h2>
            <Link
              href={`/${lang}#booking`}
              className="inline-flex items-center gap-2 bg-brand-black text-brand-white font-semibold px-8 py-4 rounded-full text-base transition-all duration-200 hover:bg-brand-black/90 hover:shadow-lg"
            >
              {t('servicesPage.cta.button')}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </section>
      </main>
    </DictionaryProvider>
  );
}
