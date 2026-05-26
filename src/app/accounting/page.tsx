import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { hasAccess, Role } from '@/utils/rbac';

export default async function AccountingDashboard() {
  const supabase = await createClient();
  
  // 1. Get the currently logged-in user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2. Fetch their employee record to get their roles
  const { data: employee } = await supabase
    .from('employees')
    .select('roles')
    .eq('email', user.email)
    .single();

  // 3. Check access! (Only SuperAdmin or Accounting can see this)
  const userRoles = (employee?.roles || []) as Role[];
  if (!hasAccess(userRoles, ['Accounting'])) {
    redirect('/unauthorized'); // Or redirect them back to the main dashboard '/'
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-black uppercase text-zinc-900">Financial Overview</h1>
      <p className="text-zinc-500">Track estimated vs final job costs.</p>
      {/* Accounting content goes here */}
    </div>
  );
}