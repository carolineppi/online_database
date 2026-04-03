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
  User // Add this icon
} from 'lucide-react';
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

  /// Fetch Campaign Mappings
  const { data: campaignSources } = await supabase.from('campaign_sources').select('*');
  const matchedCampaign = campaignSources?.find(c => c.campaign_id === submittal.quote_source);

  // Marketing Source Logic
  const isManual = submittal.quote_source === "PM Input";
  const isPaid = !!matchedCampaign || (!isManual && submittal.quote_source !== "Organic / Direct" && submittal.quote_source !== "Unknown" && !isNaN(Number(submittal.quote_source)));
  
  // Decide the display name
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
    .is('deleted_at', null); // Soft delete filter

  const { data: addons } = await supabase
    .from('add_ons')
    .select('*')
    .eq('quote_id', id)
    .is('deleted_at', null);

  function formatPhoneNumber(phoneNumberString: string): string | null {
    // 1. Remove all non-digit characters
    const cleaned = phoneNumberString.replace(/\D/g, '');

    // 2. Check if the input is valid (10 digits)
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);

    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }

    return null;
  }

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
      
      <div className="bg-white border rounded-3xl p-8 mb-8 shadow-sm">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-zinc-900">{submittal.job_name}</h1>
                <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-sm font-mono font-bold">
                  #{submittal.quote_number}
                </span>
              </div>
              <p className="text-zinc-500 text-sm">Customer: {submittal.linked_customer?.first_name} {submittal.linked_customer?.last_name} | Phone: {formatPhoneNumber(submittal.linked_customer?.phone)} | Email: {submittal.linked_customer?.email}</p>
            </div>

            {/* NEW: Marketing Source Indicator */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${
                isPaid 
                  ? 'bg-blue-50 border-blue-100 text-blue-700' 
                  : isManual
                  ? 'bg-purple-50 border-purple-100 text-purple-700'
                  : 'bg-zinc-50 border-zinc-100 text-zinc-600'
              }`}>
                {isPaid ? <Megaphone size={18} /> : isManual ? <User size={18} /> : <Globe size={18} />}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                    {isPaid ? 'Paid Acquisition' : isManual ? 'Manual Entry' : 'Organic Traffic'}
                  </p>
                  <p className="text-sm font-bold">
                    {displayName}
                  </p>
                </div>
              </div>

              <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
                submittal.status === 'WON' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {submittal.status}
              </span>
            </div>
         </div>
      </div>
      {/* NEW: Original Uploaded PDF Section */}
      {submittal.pdf_url && (
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
      )}
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