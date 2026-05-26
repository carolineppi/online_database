'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Loader2 } from 'lucide-react';
import { hasAccess, normalizeRoles } from '@/utils/rbac';

export default function AccountingPage() {
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // 1. Grab the user from local storage
    const saved = localStorage.getItem('employee');
    
    // 2. If nobody is logged in, kick to login page
    if (!saved) {
      window.location.href = '/'; // Adjust this if your login page is somewhere else
      return;
    }

    // 3. Verify their roles
    const employee = JSON.parse(saved);
    const roles = normalizeRoles(employee.roles);

    // 4. Check if they have Accounting or SuperAdmin access
    if (!hasAccess(roles, ['Accounting'])) {
      // If a PM sneaks in here, kick them to the regular dashboard
      router.replace('/submittals'); 
    } else {
      // Let them in!
      setAuthorized(true);
    }
  }, [router]);

  // Show a loading spinner while we check their credentials
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  // THE ACCOUNTING DASHBOARD
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-14 w-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
          <DollarSign size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">Financial Overview</h1>
          <p className="text-zinc-500 font-medium mt-1">Track estimated vs final job costs.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-[2.5rem] border border-zinc-200 p-8 shadow-sm min-h-[400px] flex items-center justify-center">
         <div className="text-center space-y-3">
           <DollarSign size={48} className="mx-auto text-zinc-200" />
           <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">
             Accounting Ledger Coming Soon
           </p>
         </div>
      </div>
    </div>
  );
}