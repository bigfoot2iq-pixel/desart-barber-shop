import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getRole } from '@/lib/roles';
import { getPendingAppointments } from '@/lib/queries';
import AdminDashboard from './components/AdminDashboard';

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', user.id)
    .single();

  const adminName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Admin';
  const adminEmail = profile?.email || user.email || '';

  let pendingCount = 0;
  try {
    const pendingApts = await getPendingAppointments();
    pendingCount = pendingApts.length;
  } catch {
    // Will be loaded client-side
  }

  return (
    <AdminDashboard
      initialPendingCount={pendingCount}
      adminName={adminName}
      adminEmail={adminEmail}
    />
  );
}