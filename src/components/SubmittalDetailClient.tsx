'use client';

import { useState } from 'react';
import { 
  Package, 
  FileDown, 
  CheckSquare, 
  Square, 
  Trophy, 
  RefreshCcw, 
  Trash2, 
  PlusSquare, 
  FileText, 
  PlusCircle,
  AlertCircle,
  Copy,
  Truck, 
  Edit3,
  MapPin,
  CheckCircle2 // New icon for auto-save confirmation
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import AddOptionModal from '@/components/AddOptionModal';
import AddOnForm from '@/components/AddOnForm';
import TrackingMailer from '@/components/TrackingMailer';
import EditJobFinancials from '@/components/EditJobFinancials';
import { toast } from 'sonner';

export default function SubmittalDetailClient({ submittal, options, addons, id, activeJob }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Project Details State
  const [shippingAddress, setShippingAddress] = useState(submittal.shipping_address || 'Toilet Partitions shipping to ');
  const [description, setDescription] = useState(submittal.description || 'Toilet Compartments are: ');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Modal States
  const [showAddOnForm, setShowAddOnForm] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false); 
  const [showTrackingMailer, setShowTrackingMailer] = useState(false);
  const [showEditFinancials, setShowEditFinancials] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null); 
  
  const supabase = createClient();
  const router = useRouter();

  const winnerPrice = options?.find((o: any) => o.id === activeJob?.accepted_individual_quote)?.price || 0;
  const addonsTotal = addons?.reduce((sum: number, addon: any) => sum + (Number(addon.price) || 0), 0) || 0;
  const projectTotal = Number(winnerPrice) + addonsTotal;

  const mergedJob = activeJob ? {
    ...activeJob,
    quote_submittals: submittal
  } : null;

  const toggleSelection = (optionId: string) => {
    setSelectedIds(prev => 
      prev.includes(optionId) ? prev.filter(i => i !== optionId) : [...prev, optionId]
    );
  };

  // NEW: Auto-Save Function
  const handleAutoSave = async (field: 'shipping_address' | 'description', value: string) => {
    // Only save if the value actually changed
    if (value === submittal[field]) return;

    setSaveStatus('saving');
    const { error } = await supabase
      .from('quote_submittals')
      .update({ [field]: value })
      .eq('id', id);

    if (error) {
      toast.error(`Failed to auto-save project details.`);
      setSaveStatus('idle');
    } else {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000); // Hide the "Saved" indicator after 2 seconds
      router.refresh();
    }
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
      toast.error("Failed to generate PDF");
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

  const handleDeleteOption = async (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Move this pricing option to the trash?")) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('individual_quotes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', optionId);

    if (!error) {
      toast.success("Option moved to trash");
      router.refresh();
    } else {
      toast.error("Error deleting: " + error.message);
    }
    setLoading(false);
  };

  const handleDeleteAddon = async (addonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Move this add-on to the trash?")) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('add_ons')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', addonId);

    if (!error) {
      toast.success("Add-on moved to trash");
      router.refresh();
    } else {
      toast.error("Error: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="lg:col-span-2 space-y-12">
      
      {/* SECTION: PROJECT DETAILS (AUTO-SAVING) */}
      <section>
        <div className="bg-white border border-zinc-200 rounded-[2.5rem] p-8 shadow-sm transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black flex items-center gap-2 text-zinc-900 uppercase tracking-tight">
              <MapPin size={22} className="text-blue-600" /> Project Details
            </h2>
            
            {/* Auto-Save Status Indicator */}
            <div className="h-8 flex items-center justify-end min-w-[100px]">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest animate-pulse">
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-widest animate-in fade-in">
                  <CheckCircle2 size={14} /> Saved
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Shipping Address / Location</label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                onBlur={(e) => handleAutoSave('shipping_address', e.target.value)}
                className="w-full p-4 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-2xl outline-none transition font-medium text-zinc-900 min-h-[100px] resize-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Quote Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={(e) => handleAutoSave('description', e.target.value)}
                className="w-full p-4 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-2xl outline-none transition font-medium text-zinc-900 min-h-[100px] resize-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: MATERIAL OPTIONS */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black flex items-center gap-2 text-zinc-900 uppercase tracking-tight">
            <Package size={22} className="text-blue-600" /> Pricing Options
          </h2>
          <div className="flex gap-3">
            <button 
              onClick={handleGeneratePDF}
              disabled={selectedIds.length === 0 || generating}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 disabled:opacity-50 transition shadow-lg shadow-zinc-200"
            >
              <FileDown size={14} />
              {generating ? "Generating..." : `Generate PDF (${selectedIds.length})`}
            </button>

            <button 
              onClick={() => {
                setDuplicateData(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100"
            >
              <PlusCircle size={14} /> Add Option
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {options?.map((option: any) => {
            const isWinner = activeJob?.accepted_individual_quote === option.id;

            return (
              <div 
                key={option.id} 
                className={`bg-white border rounded-3xl p-6 shadow-sm transition flex justify-between items-center relative cursor-pointer group ${
                  isWinner ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-zinc-200 hover:border-blue-300'
                }`}
                onClick={() => toggleSelection(option.id)}
              >
                {isWinner && (
                  <div className="absolute -top-3 left-8 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-md uppercase tracking-widest">
                    <Trophy size={10} /> Active Winner
                  </div>
                )}

                <div className="flex items-center gap-5">
                  <div className={`${selectedIds.includes(option.id) ? 'text-blue-600' : 'text-zinc-200'} transition-colors`}>
                    {selectedIds.includes(option.id) ? <CheckSquare size={28} /> : <Square size={28} />}
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-zinc-900 leading-tight">{option.material}</h3>
                    <p className="text-zinc-500 text-sm font-medium mt-1">
                      {option.mounting_style} • {option.manufacturer} • Qty: {option.quantity}
                    </p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end" onClick={(e) => e.stopPropagation()}>
                  <p className={`text-3xl font-black ${isWinner ? 'text-emerald-600' : 'text-zinc-900'}`}>
                    ${Number(option.price).toLocaleString()}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => {
                        const { price, id: oldId, created_at, ...rest } = option; 
                        setDuplicateData(rest);
                        setShowAddModal(true);
                      }}
                      className="p-2 text-zinc-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition border border-transparent hover:border-blue-100"
                      title="Duplicate for Similar Quote"
                    >
                      <Copy size={20} />
                    </button>

                    <button
                      onClick={(e) => handleDeleteOption(option.id, e)}
                      disabled={loading}
                      className="p-2 text-zinc-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition border border-transparent hover:border-red-100"
                      title="Move to Trash"
                    >
                      <Trash2 size={20} />
                    </button>

                    <button
                      onClick={() => handleSelectWinner(option)}
                      disabled={loading || isWinner}
                      className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-sm ${
                        isWinner 
                          ? 'bg-emerald-50 text-emerald-600 cursor-default border border-emerald-100' 
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-900 hover:text-white'
                      }`}
                    >
                      {isWinner ? <CheckSquare size={14} /> : <RefreshCcw size={14} />}
                      {isWinner ? "Selected" : "Mark Winner"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: ADD-ONS */}
      <section className="pt-12 border-t border-zinc-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black flex items-center gap-2 text-zinc-900 uppercase tracking-tight">
            <PlusSquare size={22} className="text-zinc-400" /> Additional Items
          </h2>
          
          <button 
            onClick={() => setShowAddOnForm(true)}
            className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg shadow-zinc-200"
          >
            <PlusCircle size={14} /> Add Item
          </button>
        </div>

        <div className="grid gap-4">
          {addons?.map((addon: any) => (
            <div 
              key={addon.id} 
              onClick={() => toggleSelection(addon.id)}
              className={`bg-white border rounded-3xl p-6 flex justify-between items-center shadow-sm transition cursor-pointer ${
                selectedIds.includes(addon.id) ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-zinc-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-5">
                <div className={`${selectedIds.includes(addon.id) ? 'text-blue-600' : 'text-zinc-200'}`}>
                  {selectedIds.includes(addon.id) ? <CheckSquare size={28} /> : <Square size={28} />}
                </div>
                
                <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-black text-zinc-900 text-lg leading-none">{addon.material}</h3> 
                  <p className="text-sm text-zinc-500 font-medium mt-1.5">{addon.reason || "Standard addition"}</p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end" onClick={(e) => e.stopPropagation()}>
                <p className="text-2xl font-black text-zinc-900">+${Number(addon.price).toLocaleString()}</p>
                <button 
                  onClick={(e) => handleDeleteAddon(addon.id, e)}
                  className="mt-2 p-2 text-zinc-300 hover:text-red-600 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: PROJECT TOTAL CARD */}
      <section className="pt-12">
        <div className="bg-zinc-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-zinc-300 overflow-hidden relative border border-white/5">
          <div className="absolute -top-10 -right-10 opacity-[0.03]">
            <Trophy size={280} />
          </div>

          <div className="relative z-10 grid md:grid-cols-3 gap-10 items-center">
            <div>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Winning Bid</p>
              <p className="text-3xl font-black">${Number(winnerPrice).toLocaleString()}</p>
            </div>

            <div>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Adjustments</p>
              <p className="text-3xl font-black text-blue-400">+ ${Number(addonsTotal).toLocaleString()}</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl">
                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Project Grand Total</p>
                <p className="text-5xl font-black text-emerald-400 tracking-tighter">
                  ${projectTotal.toLocaleString()}
                </p>
              </div>
              
              {mergedJob && (
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowEditFinancials(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-3.5 px-4 rounded-2xl text-xs font-black uppercase tracking-widest transition backdrop-blur-md border border-white/10"
                  >
                    <Edit3 size={16} /> Job Cost
                  </button>
                  <button 
                    onClick={() => setShowTrackingMailer(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 py-3.5 px-4 rounded-2xl text-xs font-black uppercase tracking-widest transition backdrop-blur-md border border-emerald-500/20"
                  >
                    <Truck size={16} /> Track
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <p className="mt-6 flex items-center justify-center gap-2 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
          <AlertCircle size={12} /> Deleted items can be restored from the trash within 30 days
        </p>
      </section>

      {/* MODAL OVERLAYS */}
      {showAddModal && (
        <AddOptionModal 
          quoteId={id} 
          onClose={() => {
            setShowAddModal(false);
            setDuplicateData(null);
          }} 
          initialData={duplicateData}
        />
      )}

      {showAddOnForm && (
        <AddOnForm 
          quoteId={id} 
          onClose={() => setShowAddOnForm(false)} 
        />
      )}

      {showTrackingMailer && mergedJob && (
        <TrackingMailer 
          job={mergedJob} 
          onClose={() => setShowTrackingMailer(false)} 
        />
      )}

      {showEditFinancials && mergedJob && (
        <EditJobFinancials 
          job={mergedJob} 
          onClose={() => setShowEditFinancials(false)} 
        />
      )}
    </div>
  );
}