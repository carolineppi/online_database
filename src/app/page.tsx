import Image from "next/image";
import { createClient } from '@/utils/supabase/server';
import RecentActivity from '@/components/RecentActivity';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Search, Plus, ClipboardList, UserCheck, Trash2 } from 'lucide-react'; 
import SubmittalSearchBar from '@/components/SubmittalSearchBar';
import NewSubmittalButton from '@/components/NewSubmittalButton'; // NEW IMPORT
import { revalidatePath } from 'next/cache';

export default async function Page() {
  const CURRENT_EMPLOYEE_ID = '1';
  const supabase = await createClient();

  // 1. Fetch Submittals where status is 'Pending' AND not deleted
  const { data: unquotedSubmittals, error: fetchError } = await supabase
    .from('quote_submittals')
    .select('*')
    .eq('status', 'Pending')
    .is('deleted_at', null) // Only show non-deleted items
    .order('created_at', { ascending: false });

  if (fetchError) console.error("Database Error:", fetchError.message);

  // 2. Fetch My Active Quotes (Assigned but not yet WON)
  const { data: myAssignedQuotes } = await supabase
    .from('quote_submittals')
    .select('*')
    .eq('employee_quoted', CURRENT_EMPLOYEE_ID)
    .neq('status', 'WON')
    .is('deleted_at', null) // Ensure deleted items don't show here either
    .order('created_at', { ascending: false });

  // 3. Server Action for Soft Delete
  async function softDeleteSubmittal(formData: FormData) {
    'use server';
    const id = formData.get('id');
    const supabase = await createClient();
    
    await supabase
      .from('quote_submittals')
      .update({ deleted_at: new Date().toISOString() }) // Sets the 30-day clock
      .eq('id', id);

    revalidatePath('/');
  }

  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">Pipeline Dashboard</h1>
            <p className="text-zinc-500">Manage incoming submittals and your active quotes.</p>
          </div>
          {/* NEW: Replaced Trash Link with New Entry Button */}
          <NewSubmittalButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                  <div key={item.id} className="group flex items-center hover:bg-zinc-50 transition">
                    <Link 
                      href={`/submittals/${item.id}`}
                      className="flex-grow block p-6"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
                            #{item.quote_number}
                          </span>
                          {(item.quote_source && item.quote_source !== 'Organic / Direct') && (
                            <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                              <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
                              Paid Ad
                            </span>
                          )}
                          <span className="text-xs text-zinc-400 font-medium">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-bold text-zinc-900 group-hover:text-blue-600 transition">
                          {item.job_name}
                        </h3>
                      </div>
                    </Link>

                    {/* Action Buttons: Delete & View */}
                    <div className="flex items-center gap-3 pr-6">
                      <form action={softDeleteSubmittal}>
                        <input type="hidden" name="id" value={item.id} />
                        <button 
                          type="submit"
                          className="h-9 w-9 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition shadow-sm bg-white"
                          title="Move to Trash"
                        >
                          <Trash2 size={16} />
                        </button>
                      </form>
                      <Link 
                        href={`/submittals/${item.id}`}
                        className="h-9 w-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white hover:bg-blue-600 transition shadow-lg shadow-zinc-200"
                      >
                        <Plus size={18} />
                      </Link>
                    </div>
                  </div>
                )) : (
                  <div className="p-16 text-center">
                    <p className="text-zinc-400 font-medium">All submittals have been quoted!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2"><Search size={18} /> Quick Search</h3>
              <SubmittalSearchBar />
            </div>

            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
                <UserCheck className="text-emerald-600" size={20} />
                <h2 className="font-bold text-zinc-900">Awaiting Job Status</h2>
              </div>
              <div className="p-4 space-y-3">
                {myAssignedQuotes?.map((quote) => (
                  <Link key={quote.id} href={`/submittals/${quote.id}`} className="flex flex-col p-4 bg-zinc-50 border border-zinc-100 rounded-2xl hover:border-blue-200 transition">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">#{quote.quote_number}</span>
                    <span className="text-sm font-bold text-zinc-800 truncate">{quote.job_name}</span>
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