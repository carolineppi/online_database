'use client';

import { useState } from 'react';
import { Package, FileDown, CheckSquare, Square, Trophy, RefreshCcw, Trash2, PlusSquare, FileText, PlusCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import AddOptionTrigger from '@/components/AddOptionTrigger';
import AddOnForm from '@/components/AddOnForm';

export default function SubmittalDetailClient({ submittal, options, addons, id, activeJob }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddOnForm, setShowAddOnForm] = useState(false); // NEW: Form visibility state
  const supabase = createClient();
  const router = useRouter();

  const toggleSelection = (optionId: string) => {
    setSelectedIds(prev => 
      prev.includes(optionId) ? prev.filter(i => i !== optionId) : [...prev, optionId]
    );
  };

  const handleDeleteSubmittal = async () => {
    if (!confirm("Are you sure? This will delete the submittal, all quotes, and any associated job record.")) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('quote_submittals')
      .delete()
      .eq('id', id);

    if (!error) {
      router.push('/submittals');
      router.refresh();
    } else {
      alert("Error: " + error.message);
      setLoading(false);
    }
  };

  const handleDeleteOption = async (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this option?")) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('individual_quotes')
      .delete()
      .eq('id', optionId);

    if (!error) {
      router.refresh();
    } else {
      alert("Error deleting: " + error.message);
    }
    setLoading(false);
  };

  // Logic for deleting an addon
  const handleDeleteAddon = async (addonId: string) => {
    if (!confirm("Remove this add-on item?")) return;
    const { error } = await supabase.from('add_ons').delete().eq('id', addonId);
    if (!error) router.refresh();
  };

  const handleGeneratePDF = async () => {
    if (selectedIds.length === 0) return alert("Select at least one option.");
    setGenerating(true);
    
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submittalId: id, quoteIds: selectedIds }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Proposal_${submittal.quote_number}.pdf`;
        link.click();
      }
    } catch (err) {
      console.error("PDF Error:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectWinner = async (option: any) => {
    const confirmMsg = activeJob 
      ? `Change winner to ${option.material}? This updates the sale to $${Number(option.price).toLocaleString()}.`
      : `Mark ${option.material} as the winner?`;

    if (!confirm(confirmMsg)) return;
    setLoading(true);

    const { error: jobError } = await supabase
      .from('jobs')
      .upsert({
        quote_id: id, 
        accepted_individual_quote: option.id, 
        sale_amount: option.price,
        created_at: activeJob?.created_at || new Date().toISOString(),
      }, { 
        onConflict: 'quote_id' 
      });

    await supabase
      .from('quote_submittals')
      .update({ status: 'WON' })
      .eq('id', id);

    if (!jobError) {
      router.refresh();
    } else {
      console.error("Upsert Error:", jobError);
      alert("Error updating winner: " + jobError.message);
    }
    setLoading(false);
  };

  return (
    <div className="lg:col-span-2 space-y-12">
      {/* SECTION 1: MATERIAL OPTIONS */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-zinc-800">
            <Package size={20} className="text-zinc-400" /> Material Options
          </h2>
          <div className="flex gap-3">
            <button 
              onClick={handleDeleteSubmittal}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition shadow-sm"
            >
              <Trash2 size={14} />
              Delete Record
            </button>

            <button 
              onClick={handleGeneratePDF}
              disabled={selectedIds.length === 0 || generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-md"
            >
              <FileDown size={14} />
              {generating ? "Generating..." : `Generate PDF (${selectedIds.length})`}
            </button>
            <AddOptionTrigger quoteId={id} /> 
          </div>
        </div>

        <div className="grid gap-4">
          {options?.map((option: any) => {
            const isWinner = activeJob?.accepted_individual_quote === option.id;

            return (
              <div 
                key={option.id} 
                className={`bg-white border rounded-xl p-5 shadow-sm transition flex justify-between items-center relative cursor-pointer ${
                  isWinner ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-zinc-200 hover:border-blue-300'
                }`}
                onClick={() => toggleSelection(option.id)}
              >
                {isWinner && (
                  <div className="absolute -top-3 left-6 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <Trophy size={10} /> SELECTED WINNER
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="text-blue-600">
                    {selectedIds.includes(option.id) ? <CheckSquare size={24} /> : <Square size={24} className="text-zinc-300" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-zinc-800">{option.material}</h3>
                    <p className="text-zinc-500 text-sm">{option.mounting_style} • Qty: {option.quantity}</p>
                    <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-semibold">
                      {option.manufacturer}
                    </p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end" onClick={(e) => e.stopPropagation()}>
                  <p className={`text-2xl font-black ${isWinner ? 'text-emerald-600' : 'text-zinc-900'}`}>
                    ${Number(option.price).toLocaleString()}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={(e) => handleDeleteOption(option.id, e)}
                      disabled={loading}
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button
                      onClick={() => handleSelectWinner(option)}
                      disabled={loading || isWinner}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition min-w-[120px] justify-center ${
                        isWinner 
                          ? 'bg-emerald-50 text-emerald-600 cursor-default' 
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-800 hover:text-white shadow-sm'
                      }`}
                    >
                      {isWinner ? <CheckSquare size={14} /> : <RefreshCcw size={14} />}
                      {isWinner ? "Active Winner" : activeJob ? "Change Winner" : "Select Winner"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: ADD-ONS */}
      <section className="pt-8 border-t border-zinc-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-zinc-800">
            <PlusSquare size={20} className="text-zinc-400" /> Add-on Items
          </h2>
          
          <button 
            onClick={() => setShowAddOnForm(true)}
            className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black transition shadow-sm"
          >
            <PlusCircle size={14} />
            Add Material
          </button>
        </div>

        <div className="grid gap-4">
          {addons?.map((addon: any) => (
            <div key={addon.id} className="bg-white border border-zinc-200 rounded-xl p-5 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                   <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">{addon.material}</h3> 
                  <p className="text-sm text-zinc-500 italic">{addon.reason || "No reason specified"}</p>
                  
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] font-bold bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 uppercase">
                      Qty: {addon.quantity || 1}
                    </span>
                    <span className="text-[10px] font-bold bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 uppercase">
                      {addon.manufacturer}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <p className="text-xl font-black text-zinc-900">+${Number(addon.price).toLocaleString()}</p>
                <button 
                  onClick={() => handleDeleteAddon(addon.id)}
                  className="mt-2 p-1.5 text-zinc-400 hover:text-red-600 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {addons?.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-zinc-100 rounded-xl text-zinc-400 text-sm italic">
              No add-ons associated with this submittal.
            </div>
          )}
        </div>
      </section>

      {/* FORM MODAL */}
      {showAddOnForm && (
        <AddOnForm 
          quoteId={id} 
          jobId={activeJob?.id} 
          onClose={() => setShowAddOnForm(false)} 
        />
      )}
    </div>
  );
}