import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getRole } from '@/lib/roles';
import { hasLocale } from '@/lib/i18n/config';
import { localeHref } from '@/lib/i18n/href';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(localeHref(lang, '/login'));
  }

  const role = getRole(user);

  return (
    <div className="min-h-screen bg-brand-black">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-playfair text-gold3 mb-6">Dashboard</h1>
        
        <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-brand-cream">Welcome!</h2>
              <p className="text-brand-cream/70">
                Signed in as: <span className="text-gold3">{user.email}</span>
              </p>
              <p className="text-brand-cream/70">
                Role: <span className="text-gold3 capitalize">{role}</span>
              </p>
            </div>

            {role === 'admin' && (
              <div className="p-4 bg-gold3/10 border border-gold3/30 rounded-md">
                <p className="text-gold3 font-medium">Admin Access</p>
                <p className="text-brand-cream/70 text-sm">
                  You have full access to manage the barbershop.
                </p>
              </div>
            )}

            {role === 'professional' && (
              <div className="p-4 bg-gold3/10 border border-gold3/30 rounded-md">
                <p className="text-gold3 font-medium">Professional Access</p>
                <p className="text-brand-cream/70 text-sm">
                  Manage your schedule and view your bookings.
                </p>
              </div>
            )}

            {role === 'customer' && (
              <div className="p-4 bg-gold3/10 border border-gold3/30 rounded-md">
                <p className="text-gold3 font-medium">Customer Access</p>
                <p className="text-brand-cream/70 text-sm">
                  Book appointments and view your booking history.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
