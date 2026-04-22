'use client';

import type { Locale } from '@/lib/i18n/config';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/roles';
import { DictionaryProvider, useT } from '@/lib/i18n/client-dictionary';

interface DashboardClientProps {
  dict: Record<string, unknown>;
  common: Record<string, unknown>;
  user: User;
  role: UserRole;
  lang: Locale;
}

function DashboardInner({ dict, common, user, role }: DashboardClientProps) {
  const td = useT('dashboard');
  const tc = useT('common');

  return (
    <div className="min-h-screen bg-brand-black">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-playfair text-gold3 mb-6">{tc('dashboard')}</h1>

        <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-brand-cream">{td('welcome')}</h2>
              <p className="text-brand-cream/70">
                {td('signedInAs')} <span className="text-gold3">{user.email}</span>
              </p>
              <p className="text-brand-cream/70">
                {td('role')} <span className="text-gold3 capitalize">{role}</span>
              </p>
            </div>

            {role === 'admin' && (
              <div className="p-4 bg-gold3/10 border border-gold3/30 rounded-md">
                <p className="text-gold3 font-medium">{td('adminAccess')}</p>
                <p className="text-brand-cream/70 text-sm">
                  {td('adminAccessDesc')}
                </p>
              </div>
            )}

            {role === 'professional' && (
              <div className="p-4 bg-gold3/10 border border-gold3/30 rounded-md">
                <p className="text-gold3 font-medium">{td('professionalAccess')}</p>
                <p className="text-brand-cream/70 text-sm">
                  {td('professionalAccessDesc')}
                </p>
              </div>
            )}

            {role === 'customer' && (
              <div className="p-4 bg-gold3/10 border border-gold3/30 rounded-md">
                <p className="text-gold3 font-medium">{td('customerAccess')}</p>
                <p className="text-brand-cream/70 text-sm">
                  {td('customerAccessDesc')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardClient(props: DashboardClientProps) {
  return (
    <DictionaryProvider value={{ dashboard: props.dict, common: props.common }}>
      <DashboardInner {...props} />
    </DictionaryProvider>
  );
}
