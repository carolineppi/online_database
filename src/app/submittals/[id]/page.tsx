import { createClient } from '@/utils/supabase/server';
import { ChevronLeft, FileText, Target, ExternalLink } from 'lucide-react'; // Added Target and ExternalLink icons
import Link from 'next/link';
import SubmittalDetailClient from '@/components/SubmittalDetailClient';

export default async function SubmittalDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: submittal } = await supabase
    .from('quote_submittals')
    .select(`*, linked_customer:customers!customer (*)`)
    .eq('id', id)
    .maybeSingle();

  if (!submittal) return <div className="p-8">Submittal ID {id} not found.</div>;

  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('quote_id', id)
    .maybeSingle();

  const { data: options } = await supabase
    .from('individual_quotes')
    .select('*')
    .eq('quote_id', id);

  const { data: addons } = await supabase
    .from('add_ons')
    .select('*')
    .eq('quote_id', id);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/submittals" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 mb-6 transition">
        <ChevronLeft size={20} /> Back to Inbound Submittals
      </Link>
      
      <div className="bg-white border-b border-zinc-200 mb-8 px-8 py-6 rounded-2xl shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-zinc-900">{submittal.job_name}</h1>
                <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-sm font-mono font-bold">
                  #{submittal.quote_number}
                </span>
                
                {/* 1. Paid Ad Badge */}
                {(submittal.quote_source && submittal.quote_source !== 'Direct') && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-tighter">
                    <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
                    Paid Ad
                  </span>
                )}
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

          {/* 2. Marketing Source Card */}
          {submittal.quote_source && submittal.quote_source !== 'Direct' && (
            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 p-2.5 rounded-xl text-amber-600">
                  <Target size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-amber-600 leading-none mb-1">Marketing Attribution</p>
                  <p className="text-sm font-bold text-amber-900">
                    {submittal.quote_source} {submittal.campaign_source ? `— Campaign: ${submittal.campaign_source}` : ''}
                  </p>
                  {submittal.content_source && (
                    <p className="text-xs text-amber-700/70 mt-0.5 font-medium italic">Ad Content: {submittal.content_source}</p>
                  )}
                </div>
              </div>
              
              {submittal.source_url && (
                <a 
                  href={submittal.source_url} 
                  target="_blank" 
                  className="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1.5 uppercase transition"
                >
                  View Landing Page <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <SubmittalDetailClient 
        submittal={submittal} 
        options={options} 
        addons={addons || []} 
        id={id} 
        activeJob={job} 
      />
    </div>
  );
}