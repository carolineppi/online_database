'use client';

import { useState } from 'react';
import { Package, FileDown, CheckSquare, Square, Trophy, RefreshCcw, Trash2, PlusSquare, FileText, PlusCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import AddOptionTrigger from '@/components/AddOptionTrigger';
import AddOnForm from '@/components/AddOnForm';
import { toast } from 'sonner';

export default function SubmittalDetailClient({ submittal, options, addons, id, activeJob }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddOnForm, setShowAddOnForm] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const winnerPrice = options?.find((o: any) => o.id === activeJob?.accepted_individual_quote)?.price || 0;
  const addonsTotal = addons?.reduce((sum: number, addon: any) => sum + (Number(addon.price) || 0), 0) || 0;
  const projectTotal = Number(winnerPrice) + addonsTotal;

  const toggleSelection = (optionId: string) => {
    setSelectedIds(prev => 
      prev.includes(optionId) ? prev.filter(i => i !== optionId) : [...prev, optionId]
    );
  };

  // 1. SOFT DELETE: Submittal
  const handleDeleteSubmittal = async () => {
    if (!confirm("Move this submittal to the trash? It can be restored within 30 days.")) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('quote_submittals')
      .update({ deleted_at: new Date().toISOString() }) // Soft delete
      .eq('id', id);

    if (!error) {
      toast.success("Submittal moved to trash");
      router.push('/');
      router.refresh();
    } else {
      toast.error("Error: " + error.message);
      setLoading(false);
    }
  };

  // 2. SOFT DELETE: Individual Option
  const handleDeleteOption = async (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Move this pricing option to the trash?")) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('individual_quotes')
      .update({ deleted_at: new Date().toISOString() }) // Soft delete
      .eq('id', optionId);

    if (!error) {
      toast.success("Option moved to trash");
      router.refresh();
    } else {
      toast.error("Error deleting: " + error.message);
    }
    setLoading(false);
  };

  // 3. SOFT DELETE: Add-on
  const handleDeleteAddon = async (addonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Move this add-on to the trash?")) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('add_ons')
      .update({ deleted_at: new Date().toISOString() }) // Soft delete
      .eq('id', addonId);

    if (!error) {
      toast.success("Add-on moved to trash");
      router.refresh();
    } else {
      toast.error("Error: " + error.message);
    }
    setLoading(false);
  };

  const handleGeneratePDF = async () => {
    if (selectedIds.length === 0) return toast.error("Select at least one option.");
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
      toast.success("Winner updated!");
      router.refresh();
    } else {
      toast.error("Error updating winner: " + jobError.message);
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
              Trash Submittal
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
            <div 
              key={addon.id} 
              onClick={() => toggleSelection(addon.id)}
              className={`bg-white border rounded-xl p-5 flex justify-between items-center shadow-sm transition cursor-pointer ${
                selectedIds.includes(addon.id) ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-zinc-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-blue-600">
                  {selectedIds.includes(addon.id) ? <CheckSquare size={24} /> : <Square size={24} className="text-zinc-300" />}
                </div>
                
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

              <div className="text-right flex flex-col items-end" onClick={(e) => e.stopPropagation()}>
                <p className="text-xl font-black text-zinc-900">+${Number(addon.price).toLocaleString()}</p>
                <button 
                  onClick={(e) => handleDeleteAddon(addon.id, e)}
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

      {/* SECTION 3: PROJECT TOTAL CARD */}
      <section className="pt-12">
        <div className="bg-zinc-900 rounded-3xl p-8 text-white shadow-xl shadow-zinc-200 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Trophy size={120} />
          </div>

          <div className="relative z-10 grid md:grid-cols-3 gap-8 items-center">
            <div>
              <p className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">Winning Material</p>
              <p className="text-2xl font-bold">${Number(winnerPrice).toLocaleString()}</p>
            </div>

            <div>
              <p className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">Add-ons Total</p>
              <p className="text-2xl font-bold text-blue-400">+ ${Number(addonsTotal).toLocaleString()}</p>
            </div>

            <div className="bg-white/10 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
              <p className="text-zinc-300 text-xs font-black uppercase tracking-widest mb-1">Project Grand Total</p>
              <p className="text-4xl font-black text-emerald-400">
                ${projectTotal.toLocaleString()}
              </p>
            </div>
          </div>
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