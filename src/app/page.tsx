import Image from "next/image";
import { createClient } from '@/utils/supabase/server';
import RecentActivity from '@/components/RecentActivity';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Search, Plus, ClipboardList, UserCheck } from 'lucide-react';
import SubmittalSearchBar from '@/components/SubmittalSearchBar';

export default async function Page() {
  const CURRENT_EMPLOYEE_ID = '1';
  const supabase = await createClient();
  // 2. Fetch Submittals without individual_quotes
  const { data: unquotedSubmittals, error: fetchError } = await supabase
    .from('quote_submittals')
    .select(`
      *,
      individual_quotes!left(id)
    `)
    // Try referencing the join by table name
    .filter('individual_quotes.id', 'is', null) 
    .order('created_at', { ascending: false });

  if (fetchError) console.error("Filter Error:", fetchError.message);

  // 2. Fetch My Active Quotes (Assigned but not yet WON)
  // Using employee_quoted from SQL and status logic
  const { data: myAssignedQuotes } = await supabase
    .from('quote_submittals')
    .select('*')
    .eq('employee_quoted', '1') // Replace '1' with user.id if using UUIDs
    .neq('status', 'WON')
    .order('created_at', { ascending: false });

  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">Pipeline Dashboard</h1>
            <p className="text-zinc-500">Manage incoming submittals and your active quotes.</p>
          </div>
          <Link href="/inbound-submittals" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition shadow-lg shadow-blue-200">
            <Plus size={20} /> New Submittal
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Primary Column: Pending Quotes */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
                <ClipboardList className="text-blue-600" size={24} />
                <h2 className="font-bold text-lg text-zinc-900">Pending Quotes</h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {unquotedSubmittals?.length ? unquotedSubmittals.map((item) => (
                  <Link key={item.id} href={`/submittals/${item.id}`} className="block p-6 hover:bg-zinc-50 transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-black text-blue-600 uppercase mb-1">#{item.quote_number}</p>
                        <h3 className="font-bold text-zinc-900">{item.job_name}</h3> {/* Fixed column name */}
                      </div>
                      <span className="text-xs text-zinc-400">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                )) : (
                  <div className="p-12 text-center text-zinc-400">All submittals have been quoted!</div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2"><Search size={18} /> Quick Search</h3>
              <SubmittalSearchBar />
            </div>

            {/* My Active Quotes */}
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
                <UserCheck className="text-emerald-600" size={20} />
                <h2 className="font-bold text-zinc-900">My Active Quotes</h2>
              </div>
              <div className="p-4 space-y-3">
                {myAssignedQuotes?.map((quote) => (
                  <Link key={quote.id} href={`/submittals/${quote.id}`} className="flex flex-col p-4 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-blue-200 transition">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">#{quote.quote_number}</span>
                    <span className="text-sm font-bold text-zinc-800 truncate">{quote.job_name}</span> {/* Fixed column name */}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}