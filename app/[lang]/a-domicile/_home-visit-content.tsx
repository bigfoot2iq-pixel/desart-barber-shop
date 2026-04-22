'use client';

import Link from 'next/link';
import { DictionaryProvider, useT } from '@/lib/i18n/client-dictionary';
import type { Locale } from '@/lib/i18n/config';
import type { Service, Professional } from '@/lib/types/database';

type ProfessionalWithSalon = Professional & { salon: { name: string; address: string } | null };

interface HomeVisitContentProps {
  locale: Locale;
  common: Record<string, unknown>;
  booking: Record<string, unknown>;
  services: Service[];
  professionals: ProfessionalWithSalon[];
}

function Steps() {
  const t = useT('common');
  const steps = [
    { num: '01', title: t('homeVisitPage.howItWorks.step1.title'), desc: t('homeVisitPage.howItWorks.step1.description') },
    { num: '02', title: t('homeVisitPage.howItWorks.step2.title'), desc: t('homeVisitPage.howItWorks.step2.description') },
    { num: '03', title: t('homeVisitPage.howItWorks.step3.title'), desc: t('homeVisitPage.howItWorks.step3.description') },
  ];

  return (
    <section className="bg-brand-black text-brand-white py-20 px-4">
      <div className="max-w-[960px] mx-auto">
        <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-center mb-14">
          {t('homeVisitPage.howItWorks.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.num} className="text-center">
              <span className="text-gold3 font-bold text-5xl font-playfair block mb-4">{step.num}</span>
              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-[rgb(254_251_243/60%)] text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCards({ services }: { services: Service[] }) {
  const t = useT('common');

  return (
    <section className="bg-gold-bg text-brand-black py-20 px-4">
      <div className="max-w-[960px] mx-auto">
        <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-center mb-4">
          {t('servicesPage.hero.title')}
        </h2>
        <p className="text-center text-[rgb(10_8_0/60%)] mb-14 max-w-lg mx-auto">
          {t('homeVisitPage.pricing.fee')} — {t('homeVisitPage.pricing.note')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service) => (
            <div key={service.id} className="bg-white rounded-xl p-6 border border-[rgb(10_8_0/8%)] shadow-sm">
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
      </div>
    </section>
  );
}

function FAQ() {
  const t = useT('common');
  const faqs = ['q1', 'q2', 'q3', 'q4'] as const;

  return (
    <section className="bg-brand-black text-brand-white py-20 px-4">
      <div className="max-w-[720px] mx-auto">
        <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-center mb-14">
          {t('homeVisitPage.faq.title')}
        </h2>
        <div className="flex flex-col gap-6">
          {faqs.map((q) => (
            <div key={q} className="bg-[rgb(254_251_243/5%)] rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-2">{t(`homeVisitPage.faq.${q}.question`)}</h3>
              <p className="text-sm text-[rgb(254_251_243/60%)] leading-relaxed">{t(`homeVisitPage.faq.${q}.answer`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeVisitContent({ locale, common, booking, services, professionals }: HomeVisitContentProps) {
  const t = useT('common');
  const lang = locale;

  return (
    <DictionaryProvider value={{ common, booking }}>
      <main>
        {/* Hero */}
        <section className="relative bg-brand-black text-brand-white min-h-[80vh] flex items-center py-20 px-4">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-b from-gold3/10 to-transparent" />
          </div>
          <div className="relative max-w-[800px] mx-auto text-center">
            <span className="inline-block text-gold3 text-xs font-semibold tracking-[0.2em] uppercase mb-6">
              {t('homeVisitPage.hero.eyebrow')}
            </span>
            <h1 className="font-playfair text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              {t('homeVisitPage.hero.title')}
            </h1>
            <p className="text-xl sm:text-2xl text-[rgb(254_251_243/70%)] mb-4 font-light">
              {t('homeVisitPage.hero.subtitle')}
            </p>
            <p className="text-base text-[rgb(254_251_243/50%)] mb-10 max-w-lg mx-auto leading-relaxed">
              {t('homeVisitPage.hero.description')}
            </p>
            <Link
              href={`/${lang}#booking`}
              className="inline-flex items-center gap-2 bg-gold3 text-brand-black font-semibold px-8 py-4 rounded-full text-base transition-all duration-200 hover:bg-gold3/90 hover:shadow-lg"
            >
              {t('homeVisitPage.hero.cta')}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </section>

        {/* How It Works */}
        <Steps />

        {/* Services */}
        <ServiceCards services={services} />

        {/* Professionals */}
        {professionals.length > 0 && (
          <section className="bg-gold-bg text-brand-black py-20 px-4">
            <div className="max-w-[960px] mx-auto">
              <h2 className="font-playfair text-3xl sm:text-4xl font-bold text-center mb-14">
                {t('homeVisitPage.hero.eyebrow')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {professionals.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl p-6 border border-[rgb(10_8_0/8%)] text-center">
                    {p.profile_image_url && (
                      <img
                        src={p.profile_image_url}
                        alt={p.display_name}
                        className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-2 border-gold3/20"
                      />
                    )}
                    <h3 className="font-semibold text-lg">{p.display_name}</h3>
                    <p className="text-sm text-[rgb(10_8_0/50%)] mt-1">
                      {p.profession} · {p.years_of_experience}+ {locale === 'fr' ? 'ans' : 'years'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <FAQ />

        {/* CTA */}
        <section className="bg-gold-bg text-brand-black py-20 px-4 text-center">
          <div className="max-w-[600px] mx-auto">
            <h2 className="font-playfair text-3xl sm:text-4xl font-bold mb-8">
              {t('homeVisitPage.cta.title')}
            </h2>
            <Link
              href={`/${lang}#booking`}
              className="inline-flex items-center gap-2 bg-brand-black text-brand-white font-semibold px-8 py-4 rounded-full text-base transition-all duration-200 hover:bg-brand-black/90 hover:shadow-lg"
            >
              {t('homeVisitPage.cta.button')}
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
