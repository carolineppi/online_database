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
  MapPin // NEW: Added for the Zip Code UI
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

  // Boolean helper to check if this was a multi-file submission
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
      
      {/* CONDITIONAL RENDERING: 
        If it has the new `file_urls` array, show the multi-file & zip code layout. 
        Otherwise, if it has the old `pdf_url`, fallback to the single-file layout. 
      */}
      {hasMultipleFiles ? (
        <section className="mb-12">
          <div className="bg-zinc-50 border border-zinc-200 rounded-[2.5rem] p-8 flex flex-col gap-6">
            
            {/* Header Area for Layout Docs */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-zinc-200 flex items-center justify-center text-blue-500">
                  <FileText size={32} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Layout Upload Tool</p>
                  <h3 className="text-lg font-black text-zinc-900">Submitted Drawings & Details</h3>
                  <p className="text-sm text-zinc-500 font-medium">Uploaded on {new Date(submittal.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Zip Code Badge */}
              {submittal.zip_code && (
                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-zinc-200 shadow-sm w-full md:w-auto">
                  <div className="p-2 bg-zinc-50 rounded-lg">
                    <MapPin size={18} className="text-zinc-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Shipping Zip Code</span>
                    <span className="text-sm font-bold text-zinc-900">{submittal.zip_code}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-zinc-200 w-full my-2"></div>

            {/* List of Uploaded Files */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {submittal.file_urls.map((url: string, index: number) => {
                // Extract file extension to display a clean name
                const extMatch = url.match(/\.([^.?]+)(\?.*)?$/);
                const ext = extMatch ? extMatch[1].toUpperCase() : 'FILE';
                
                return (
                  <div key={index} className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="bg-zinc-100 text-zinc-500 p-2 rounded-lg text-xs font-bold">
                        {ext}
                      </div>
                      <span className="text-sm font-bold text-zinc-800 truncate">Drawing {index + 1}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Link 
                        href={url} 
                        target="_blank"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition"
                      >
                        <ExternalLink size={12} /> View
                      </Link>
                      <a 
                        href={url} 
                        download={`Drawing_${index + 1}`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition"
                      >
                        <Download size={12} /> Save
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>
      ) : submittal.pdf_url ? (
        // --- LEGACY FALLBACK FOR SINGLE PDF UPLOADS ---
        <section className="mb-12">
          <div className="bg-zinc-50 border border-zinc-200 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-zinc-200 flex items-center justify-center text-red-500">
                <FileText size={32} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Source Document</p>
                <h3 className="text-lg font-black text-zinc-900">Original Quote Tool PDF</h3>
                <p className="text-sm text-zinc-500 font-medium">Uploaded on {new Date(submittal.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <Link 
                href={submittal.pdf_url} 
                target="_blank"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-50 transition"
              >
                <ExternalLink size={14} /> View PDF
              </Link>
              <a 
                href={submittal.pdf_url} 
                download 
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg shadow-zinc-200"
              >
                <Download size={14} /> Download
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