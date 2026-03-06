import { createClient } from '@/utils/supabase/server';
import { RotateCcw, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function TrashPage() {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: trashedItems } = await supabase
    .from('quote_submittals')
    .select('*')
    .not('deleted_at', 'is', null)
    .gte('deleted_at', thirtyDaysAgo)
    .order('deleted_at', { ascending: false });

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 mb-6 transition font-bold text-sm">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="p-8 border-b bg-zinc-50/50 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 uppercase">Trash Bin</h1>
            <p className="text-zinc-500 text-sm">Items are permanently deleted after 30 days.</p>
          </div>
          <Trash2 size={24} className="text-zinc-300" />
        </div>

        <div className="divide-y divide-zinc-100">
          {trashedItems?.length ? trashedItems.map((item) => (
            <div key={item.id} className="p-6 flex justify-between items-center bg-white">
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">#{item.quote_number}</p>
                <h3 className="font-bold text-zinc-800">{item.job_name}</h3>
                <p className="text-[10px] text-red-500 font-bold uppercase mt-1">
                  Deleted on {new Date(item.deleted_at).toLocaleDateString()}
                </p>
              </div>
              
              <form action={async () => {
                'use server';
                const supabase = await createClient();
                await supabase.from('quote_submittals').update({ deleted_at: null }).eq('id', item.id);
              }}>
                <button type="submit" className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-700 transition">
                  <RotateCcw size={14} /> Restore
                </button>
              </form>
            </div>
          )) : (
            <div className="p-20 text-center text-zinc-400 font-medium">Trash is empty.</div>
          )}
        </div>
      </div>
    </main>
  );
}