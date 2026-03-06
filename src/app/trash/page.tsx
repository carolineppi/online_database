import { createClient } from '@/utils/supabase/server';
import { RotateCcw, Trash2, ArrowLeft, FileText, Layout, Briefcase, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = 'submittals' } = await searchParams;
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Restore Action
  async function restoreItem(formData: FormData) {
    'use server';
    const id = formData.get('id');
    const table = formData.get('table') as string;
    const supabase = await createClient();
    await supabase.from(table).update({ deleted_at: null }).eq('id', id);
    revalidatePath('/trash');
  }

  // 2. PERMANENT PURGE ACTION
  async function purgeCategory(formData: FormData) {
    'use server';
    const table = formData.get('table') as string;
    const supabase = await createClient();
    
    // 1. Perform the physical delete
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .not('deleted_at', 'is', null);

    if (deleteError) {
      console.error("Purge failed:", deleteError.message);
      return;
    }

    // 2. Log the activity in settings
    await supabase
      .from('settings')
      .update({
        last_purge_at: new Date().toISOString(),
        last_purge_by: 'Admin', // In a production app, use user.email or user.id
        last_purge_table: table
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    revalidatePath('/trash');
    revalidatePath('/settings');
  }
  // 3. Data Fetching
  let data: any[] = [];
  let currentTable = 'quote_submittals';
  
  if (view === 'submittals') {
    currentTable = 'quote_submittals';
    const { data: res } = await supabase.from(currentTable).select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    data = res || [];
  } else if (view === 'quotes') {
    currentTable = 'individual_quotes';
    const { data: res } = await supabase.from(currentTable).select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    data = res || [];
  } else if (view === 'jobs') {
    currentTable = 'jobs';
    const { data: res } = await supabase.from(currentTable).select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    data = res || [];
  }

  const tabs = [
    { id: 'submittals', label: 'Submittals', icon: FileText },
    { id: 'quotes', label: 'Quotes', icon: Layout },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto min-h-screen bg-zinc-50">
      <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 mb-8 transition font-bold text-xs uppercase tracking-widest">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-xl">
        <div className="p-8 border-b bg-white">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-black text-zinc-900 uppercase">System Trash</h1>
              <p className="text-zinc-500 text-sm">Items here will automatically expire after 30 days.</p>
            </div>
            
            {/* 4. THE PURGE BUTTON */}
            {data.length > 0 && (
              <form action={purgeCategory} onSubmit={(e) => {
                if(!confirm("⚠️ PERMANENT DELETE: Are you sure you want to wipe all items in this category? This cannot be undone.")) {
                  e.preventDefault();
                }
              }}>
                <input type="hidden" name="table" value={currentTable} />
                <button type="submit" className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition group">
                  <AlertTriangle size={14} className="group-hover:animate-pulse" /> Purge {view}
                </button>
              </form>
            )}
          </div>

          <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl w-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = view === tab.id;
              return (
                <Link key={tab.id} href={`/trash?view=${tab.id}`} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                  <Icon size={16} /> {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-zinc-100 min-h-[400px]">
          {data.length ? data.map((item) => (
            <div key={item.id} className="p-6 flex justify-between items-center bg-white hover:bg-zinc-50/50 transition">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-100 px-2 py-0.5 rounded">ID: {item.id}</span>
                  <span className="text-[10px] text-red-500 font-bold uppercase">Deleted {new Date(item.deleted_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-zinc-800 text-lg">{item.job_name || item.material || `Record #${item.id}`}</h3>
              </div>
              
              <form action={restoreItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="table" value={currentTable} />
                <button type="submit" className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg shadow-zinc-200">
                  <RotateCcw size={16} /> Restore
                </button>
              </form>
            </div>
          )) : (
            <div className="py-32 text-center">
               <Trash2 size={48} className="mx-auto mb-4 text-zinc-100" />
               <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">This category is empty</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}