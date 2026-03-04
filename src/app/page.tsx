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
    // 2. Fetch Submittals where status is 'Pending'
    const { data: unquotedSubmittals, error: fetchError } = await supabase
      .from('quote_submittals')
      .select('*')
      .eq('status', 'Pending') // This matches your SQL 'Pending' rows
      .order('created_at', { ascending: false });

    if (fetchError) console.error("Database Error:", fetchError.message);

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
          {/* <Link href="/inbound-submittals" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition shadow-lg shadow-blue-200">
            <Plus size={20} /> New Submittal
          </Link> */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Primary Column: Pending Quotes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b bg-zinc-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-zinc-900">Pending Quotes</h2>
                  <p className="text-xs text-zinc-500 uppercase font-black">Requires Attention</p>
                </div>
              </div>
              <span className="bg-zinc-100 text-zinc-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                {unquotedSubmittals?.length || 0} Total
              </span>
            </div>

            <div className="divide-y divide-zinc-100">
              {unquotedSubmittals?.length ? unquotedSubmittals.map((item) => (
                <Link 
                  key={item.id} 
                  href={`/submittals/${item.id}`}
                  className="group block p-6 hover:bg-zinc-50 transition"
                >
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
                          #{item.quote_number}
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-bold text-zinc-900 group-hover:text-blue-600 transition">
                        {item.job_name}
                      </h3>
                    </div>
                    <div className="h-8 w-8 rounded-full border border-zinc-200 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white transition">
                      <Plus size={16} />
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="p-16 text-center">
                  <p className="text-zinc-400 font-medium">All submittals have been quoted!</p>
                  <p className="text-xs text-zinc-300 mt-1 uppercase font-black">Great job clearing the queue.</p>
                </div>
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