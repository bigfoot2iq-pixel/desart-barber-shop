import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getRole } from '@/lib/roles';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = getRole(user);

  if (role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-brand-black">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-playfair text-gold3 mb-6">Admin Dashboard</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">Manage Barbers</h2>
            <p className="text-brand-cream/70 text-sm">Add, edit, or remove barbers.</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">Manage Services</h2>
            <p className="text-brand-cream/70 text-sm">Update services, prices, and durations.</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">All Bookings</h2>
            <p className="text-brand-cream/70 text-sm">View and manage all customer bookings.</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">User Management</h2>
            <p className="text-brand-cream/70 text-sm">Manage user roles and permissions.</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">Analytics</h2>
            <p className="text-brand-cream/70 text-sm">View booking trends and revenue reports.</p>
          </div>

          <div className="bg-brand-dark/50 backdrop-blur-sm rounded-lg p-6 border border-gold3/20">
            <h2 className="text-lg font-semibold text-brand-cream mb-2">Settings</h2>
            <p className="text-brand-cream/70 text-sm">Configure barbershop settings.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
