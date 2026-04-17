import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getRole } from '@/lib/roles';

export default async function ProfessionalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = getRole(user);

  if (role !== 'professional') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-brand-black">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-playfair text-gold3 mb-6">Professional Dashboard</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">My Schedule</h2>
            <p className="text-brand-cream/70 text-sm">View and manage your availability.</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">Today's Bookings</h2>
            <p className="text-brand-cream/70 text-sm">See your appointments for today.</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">Upcoming Bookings</h2>
            <p className="text-brand-cream/70 text-sm">View your future appointments.</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">My Profile</h2>
            <p className="text-brand-cream/70 text-sm">Update your profile and settings.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
