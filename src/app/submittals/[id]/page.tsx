import { createClient } from '@/utils/supabase/server';
import { ChevronLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import SubmittalDetailClient from '@/components/SubmittalDetailClient';

export default async function SubmittalDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch Submittal with Customer
  const { data: submittal } = await supabase
    .from('quote_submittals')
    .select(`*, linked_customer:customers!customer (*)`)
    .eq('id', id)
    .maybeSingle();

  if (!submittal) return <div className="p-8">Submittal ID {id} not found.</div>;

  // 2. Fetch Job details to identify the winning option and sale amount
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('submittal_id', id)
    .maybeSingle();

  // 3. Fetch all quote options
  const { data: options } = await supabase
    .from('individual_quotes')
    .select('*')
    .eq('quote_id', id);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/submittals" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 mb-6 transition">
        <ChevronLeft size={20} /> Back to Inbound Submittals
      </Link>
      
      {/* Existing Header Logic */}
      <div className="bg-white border-b border-zinc-200 mb-8 px-8 py-6 rounded-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-zinc-900">{submittal.job_name}</h1>
              <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-sm font-mono font-bold">
                #{submittal.quote_number}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 text-sm text-zinc-500">
               <span className="font-semibold text-zinc-700">
                 {submittal.linked_customer?.first_name} {submittal.linked_customer?.last_name}
               </span>
               <span>{submittal.linked_customer?.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {submittal.pdf_url && (
              <a href={submittal.pdf_url} target="_blank" className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-50">
                <FileText size={14} className="text-red-500" /> View Original PDF
              </a>
            )}
            <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
              submittal.status === 'Won' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {submittal.status}
            </span>
          </div>
        </div>
      </div>

      {/* Insert the Client Component here to handle the dynamic options list */}
      <SubmittalDetailClient submittal={submittal} options={options} id={id} />
    </div>
  );
}