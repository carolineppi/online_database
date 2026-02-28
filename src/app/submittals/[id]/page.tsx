import { createClient } from '@/utils/supabase/server';
import { ChevronLeft, Package, User, CheckCircle2, FileText} from 'lucide-react';
import Link from 'next/link';
import AddOptionTrigger from '@/components/AddOptionTrigger';
import SelectWinnerButton from '@/components/SelectWinnerButton';
import CustomerLookup from '@/components/CustomerLookup'; // Import the lookup component

export default async function SubmittalDetails({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: submittal, error } = await supabase
    .from('quote_submittals')
    .select(`
      *,
      pdf_url, 
      linked_customer:customers!customer (
        first_name,
        last_name,
        phone,
        email
      )
    `)
    .eq('id', id)
    .maybeSingle(); // Using maybeSingle() is safer than .single()

  if (error) {
    console.error("Query Error:", error.message);
  }

  if (!submittal) return <div className="p-8">Submittal ID {id} not found.</div>;

  const { data: options } = await supabase
    .from('individual_quotes')
    .select('*')
    .eq('quote_id', id);

  if (!submittal) return <div className="p-8">Submittal ID {id} not found.</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Navigation */}
      <Link href="/submittals" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 mb-6 transition">
        <ChevronLeft size={20} /> Back to Inbound Submittals
      </Link>
      
    {/* Header Section */}
    <div className="bg-white border-b border-zinc-200 mb-8 px-8 py-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-zinc-900">{submittal.job_name}</h1>
            <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-sm font-mono font-bold">
              #{submittal.quote_number}
            </span>
          </div>
          
          {/* Customer Quick-Details Row */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-zinc-500">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                {submittal.linked_customer?.first_name[0]}{submittal.linked_customer?.last_name[0]}
              </div>
              <span className="font-semibold text-zinc-700">
                {submittal.linked_customer?.first_name} {submittal.linked_customer?.last_name}
              </span>
            </div>
            
            <a href={`mailto:${submittal.linked_customer?.email}`} className="hover:text-blue-600 transition">
              {submittal.linked_customer?.email}
            </a>
            
            <span className="font-mono">
              {/* Formats the raw bigint back to (XXX) XXX-XXXX for the UI */}
              {submittal.linked_customer?.phone.toString().replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 pb-1">
          {/* NEW: View Original PDF Button */}
          {submittal.pdf_url && (
            <a 
              href={submittal.pdf_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-50 hover:text-zinc-900 transition shadow-sm"
            >
              <FileText size={14} className="text-red-500" />
              View Original PDF
            </a>
          )}

          <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border shadow-sm ${
            submittal.status === 'Won' 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {submittal.status}
          </span>
        </div>
      </div>
    </div>

      {/* Main Grid Layout */}
        
        {/* Left Column: Quote Options */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-zinc-800">
                <Package size={20} className="text-zinc-400" /> Material Options
              </h2>
              <AddOptionTrigger quoteId={id} /> 
            </div>

            <div className="grid gap-4">
              {options?.map((option) => (
                <div key={option.id} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg text-zinc-800">{option.material}</h3>
                    <p className="text-zinc-500 text-sm">{option.mounting_style} • Qty: {option.quantity}</p>
                    <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-semibold">
                      {option.manufacturer}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-zinc-900">
                      ${Number(option.price).toLocaleString()}
                    </p>
                    
                    {!submittal.is_job && (
                      <div className="mt-2">
                        <SelectWinnerButton 
                          quoteId={id} 
                          optionId={option.id} 
                          price={option.price} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {options?.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400">
                  No material options created yet.
                </div>
              )}
            </div>
          </section>
        </div>
    </div>
  );
}