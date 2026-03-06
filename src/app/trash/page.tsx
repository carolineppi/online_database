import { createClient } from '@/utils/supabase/server';
import { RotateCcw, Trash2, ArrowLeft, FileText, Layout, Briefcase, AlertTriangle, PlusSquare } from 'lucide-react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export default async function TrashPage(props: {
  searchParams: Promise<{ view?: string }>;
}) {
  const resolvedParams = await props.searchParams;
  const view = resolvedParams.view || 'submittals';
  
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  async function restoreItem(formData: FormData) {
    'use server';
    const id = formData.get('id');
    const table = formData.get('table') as string;
    const supabase = await createClient();
    
    await supabase.from(table).update({ deleted_at: null }).eq('id', id);
    revalidatePath('/trash');
    revalidatePath('/'); 
  }

  async function purgeCategory(formData: FormData) {
    'use server';
    const table = formData.get('table') as string;
    const supabase = await createClient();
    
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .not('deleted_at', 'is', null);

    if (deleteError) {
      console.error("Purge failed:", deleteError.message);
      return;
    }

    await supabase
      .from('settings')
      .update({
        last_purge_at: new Date().toISOString(),
        last_purge_by: 'Admin', 
        last_purge_table: table
      })
      .eq('id', '00000000-0000-0000-0000-000000000000');

    revalidatePath('/trash');
    revalidatePath('/settings'); 
  }

  // 1. Updated Data Fetching to include 'add_ons'
  let data: any[] = [];
  let currentTable = 'quote_submittals';
  
  if (view === 'submittals') {
    currentTable = 'quote_submittals';
  } else if (view === 'quotes') {
    currentTable = 'individual_quotes';
  } else if (view === 'jobs') {
    currentTable = 'jobs';
  } else if (view === 'addons') {
    currentTable = 'add_ons'; // Target the add_ons table
  }

  const { data: res } = await supabase
    .from(currentTable)
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  
  data = res || [];

  // 2. Added 'addons' to the tabs array
  const tabs = [
    { id: 'submittals', label: 'Submittals', icon: FileText },
    { id: 'quotes', label: 'Quotes', icon: Layout },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'addons', label: 'Add-ons', icon: PlusSquare }, // New Add-ons Tab
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto min-h-screen bg-zinc-50/50">
      <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 mb-8 transition font-bold text-xs uppercase tracking-widest">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-xl">
        <div className="p-8 border-b bg-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-black text-zinc-900 uppercase">System Trash</h1>
              <p className="text-zinc-500 text-sm">Items are kept for 30 days before automatic expiration.</p>
            </div>
            
            {data.length > 0 && (
              <form action={purgeCategory}>
                <input type="hidden" name="table" value={currentTable} />
                <button 
                  type="submit" 
                  className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition group"
                >
                  <AlertTriangle size={14} className="group-hover:animate-pulse" /> 
                  Purge {view}
                </button>
              </form>
            )}
          </div>

          <div className="flex flex-wrap gap-2 p-1 bg-zinc-100 rounded-2xl w-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = view === tab.id;
              return (
                <Link 
                  key={tab.id} 
                  href={`/trash?view=${tab.id}`} 
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition ${
                    isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <Icon size={16} /> {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-zinc-100 min-h-[400px]">
          {data.length ? data.map((item) => (
            <div key={item.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center bg-white hover:bg-zinc-50/50 transition gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-100 px-2 py-0.5 rounded">
                    ID: {item.id}
                  </span>
                  <span className="text-[10px] text-red-500 font-bold uppercase">
                    Deleted {new Date(item.deleted_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-bold text-zinc-800 text-lg">
                  {/* Handle 'material' field used in add_ons and individual_quotes */}
                  {item.job_name || item.material || `Record #${item.id}`}
                </h3>
              </div>
              
              <form action={restoreItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="table" value={currentTable} />
                <button 
                  type="submit" 
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-zinc-900 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg shadow-zinc-200"
                >
                  <RotateCcw size={16} /> Restore
                </button>
              </form>
            </div>
          )) : (
            <div className="py-32 text-center">
               <Trash2 size={48} className="mx-auto mb-4 text-zinc-100" />
               <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm italic">
                 The {view} trash is currently empty.
               </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}