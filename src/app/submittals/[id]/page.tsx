import { createClient } from '@/utils/supabase/server';
import { ChevronLeft, FileText, Target, ExternalLink, Trash2 } from 'lucide-react'; 
import Link from 'next/link';
import SubmittalDetailClient from '@/components/SubmittalDetailClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Next.js 15: params must be a Promise
export default async function SubmittalDetails({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  // 1. Await the params before accessing the ID
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const supabase = await createClient();

  // 2. Server Action for Submittal Soft Delete
  async function softDeleteSubmittal() {
    'use server';
    const supabase = await createClient();
    await supabase
      .from('quote_submittals')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    // Clear caches and redirect
    revalidatePath('/');
    revalidatePath('/trash');
    redirect('/'); 
  }

  // 3. Fetch data with 'deleted_at' filter
  const { data: submittal } = await supabase
    .from('quote_submittals')
    .select(`*, linked_customer:customers!customer (*)`)
    .eq('id', id)
    .is('deleted_at', null) 
    .maybeSingle();

  if (!submittal) {
    return (
      <div className="p-8 text-center mt-20">
        <h2 className="text-xl font-bold text-zinc-800">Submittal not found</h2>
        <p className="text-zinc-500 mb-6">This item may have been moved to the trash.</p>
        <Link href="/" className="text-blue-600 font-bold underline">Return to Dashboard</Link>
      </div>
    );
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('quote_id', id)
    .is('deleted_at', null)
    .maybeSingle();

  const { data: options } = await supabase
    .from('individual_quotes')
    .select('*')
    .eq('quote_id', id)
    .is('deleted_at', null); // Soft delete filter

  const { data: addons } = await supabase
    .from('add_ons')
    .select('*')
    .eq('quote_id', id)
    .is('deleted_at', null);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 transition font-bold text-sm">
          <ChevronLeft size={20} /> Back to Dashboard
        </Link>

        {/* Action button inside a form for Server Action */}
        <form action={softDeleteSubmittal}>
          <button 
            type="submit"
            className="flex items-center gap-2 text-zinc-400 hover:text-red-600 transition text-xs font-black uppercase tracking-widest"
            formAction={softDeleteSubmittal}
          >
            <Trash2 size={16} /> Move to Trash
          </button>
        </form>
      </div>
      
      {/* ... Header UI ... */}
      <div className="bg-white border rounded-3xl p-8 mb-8 shadow-sm">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-zinc-900">{submittal.job_name}</h1>
                <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-sm font-mono font-bold">
                  #{submittal.quote_number}
                </span>
              </div>
              <p className="text-zinc-500 text-sm">Customer: {submittal.linked_customer?.first_name} {submittal.linked_customer?.last_name}</p>
            </div>
            <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
              submittal.status === 'WON' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {submittal.status}
            </span>
         </div>
      </div>

      <SubmittalDetailClient 
        submittal={submittal} 
        options={options || []} 
        addons={addons || []} 
        id={id} 
        activeJob={job} 
      />
    </div>
  );
}