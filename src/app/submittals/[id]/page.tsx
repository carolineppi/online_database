import { createClient } from '@/utils/supabase/server';
import { 
  ChevronLeft, 
  Trash2, 
  Globe, 
  Target,
  Megaphone, 
  FileText, 
  ExternalLink,
  Download,
  User,
  MapPin
} from 'lucide-react';
import Link from 'next/link';
import SubmittalDetailClient from '@/components/SubmittalDetailClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import SubmittalHeader from '@/components/SubmittalHeader';

export default async function SubmittalDetails({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const supabase = await createClient();

  async function softDeleteSubmittal() {
    'use server';
    const supabase = await createClient();
    await supabase
      .from('quote_submittals')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    revalidatePath('/');
    revalidatePath('/trash');
    redirect('/'); 
  }

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

  const { data: campaignSources } = await supabase.from('campaign_sources').select('*');
  const matchedCampaign = campaignSources?.find(c => c.campaign_id === submittal.quote_source);

  const isManual = submittal.quote_source === "PM Input";
  const isPaid = !!matchedCampaign || (!isManual && submittal.quote_source !== "Organic / Direct" && submittal.quote_source !== "Unknown" && !isNaN(Number(submittal.quote_source)));
  
  const displayName = matchedCampaign 
    ? matchedCampaign.campaign_name 
    : (isPaid ? (submittal.campaign_source || submittal.quote_source) : (isManual ? 'PM Input' : 'Direct / Search'));

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
    .is('deleted_at', null);

  const { data: addons } = await supabase
    .from('add_ons')
    .select('*')
    .eq('quote_id', id)
    .is('deleted_at', null);

  const { data: documents } = await supabase
    .from('job_documents')
    .select('*')
    .eq('quote_id', id)
    .order('created_at', { ascending: false });

  const hasMultipleFiles = submittal.file_urls && Array.isArray(submittal.file_urls) && submittal.file_urls.length > 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 transition font-bold text-sm">
          <ChevronLeft size={20} /> Back to Dashboard
        </Link>

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
      
      <SubmittalHeader 
        submittal={submittal} 
        isPaid={isPaid} 
        isManual={isManual} 
        displayName={displayName} 
      />
      
      {hasMultipleFiles ? (
        <section className="mb-8">
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-5 md:p-6 flex flex-col gap-4">
            
            {/* COMPACT Header Area */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-zinc-200 flex items-center justify-center text-blue-500 shrink-0">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 leading-tight">Submitted Drawings</h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">Uploaded {new Date(submittal.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* COMPACT Zip Code Badge */}
              {submittal.zip_code && (
                <div className="flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-xl border border-zinc-200 shadow-sm w-full md:w-auto shrink-0">
                  <MapPin size={16} className="text-zinc-500" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-none">Shipping Zip</span>
                    <span className="text-sm font-bold text-zinc-900 leading-none mt-1">{submittal.zip_code}</span>
                  </div>
                </div>
              )}
            </div>

            {/* COMPACT Grid Layout for files (Fits up to 5 in a row on big screens) */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {submittal.file_urls.map((url: string, index: number) => {
                const extMatch = url.match(/\.([^.?]+)(\?.*)?$/);
                const ext = extMatch ? extMatch[1].toUpperCase() : 'FILE';
                
                return (
                  <div key={index} className="bg-white border border-zinc-200 rounded-xl p-3 flex flex-col gap-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {ext}
                      </div>
                      <span className="text-xs font-bold text-zinc-800 truncate">Doc {index + 1}</span>
                    </div>
                    
                    <div className="flex gap-1.5">
                      <Link 
                        href={url} 
                        target="_blank"
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-zinc-100 transition"
                      >
                        <ExternalLink size={10} /> View
                      </Link>
                      <a 
                        href={url} 
                        download={`Drawing_${index + 1}`}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-zinc-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition"
                      >
                        <Download size={10} /> Save
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>
      ) : submittal.pdf_url ? (
        // COMPACT Legacy fallback
        <section className="mb-8">
          <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-zinc-200 flex items-center justify-center text-red-500 shrink-0">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Source Document</p>
                <h3 className="text-base font-black text-zinc-900 leading-tight">Original Quote Tool PDF</h3>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">Uploaded {new Date(submittal.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <Link 
                href={submittal.pdf_url} 
                target="_blank"
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-zinc-200 text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition"
              >
                <ExternalLink size={12} /> View PDF
              </Link>
              <a 
                href={submittal.pdf_url} 
                download 
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg shadow-zinc-200"
              >
                <Download size={12} /> Download
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <SubmittalDetailClient 
        submittal={submittal} 
        options={options || []} 
        addons={addons || []} 
        id={id} 
        activeJob={job} 
        initialDocuments={documents || []}
      />
    </div>
  );
}