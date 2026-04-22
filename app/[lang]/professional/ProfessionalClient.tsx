'use client';

import type { Locale } from '@/lib/i18n/config';
import type { User } from '@supabase/supabase-js';
import { DictionaryProvider, useT } from '@/lib/i18n/client-dictionary';

interface ProfessionalClientProps {
  dict: Record<string, unknown>;
  common: Record<string, unknown>;
  user: User;
  lang: Locale;
}

function ProfessionalInner({ dict, user }: ProfessionalClientProps) {
  const td = useT('dashboard');

  return (
    <div className="min-h-screen bg-brand-black">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-playfair text-gold3 mb-6">{td('professionalH1')}</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">{td('mySchedule')}</h2>
            <p className="text-brand-cream/70 text-sm">{td('myScheduleDesc')}</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">{td('todaysBookings')}</h2>
            <p className="text-brand-cream/70 text-sm">{td('todaysBookingsDesc')}</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">{td('upcomingBookings')}</h2>
            <p className="text-brand-cream/70 text-sm">{td('upcomingBookingsDesc')}</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">{td('myProfile')}</h2>
            <p className="text-brand-cream/70 text-sm">{td('myProfileDesc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfessionalClient(props: ProfessionalClientProps) {
  return (
    <DictionaryProvider value={{ dashboard: props.dict, common: props.common }}>
      <ProfessionalInner {...props} />
    </DictionaryProvider>
  );
}
