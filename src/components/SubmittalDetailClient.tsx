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
  CheckCircle2,
  UploadCloud, 
  File,
  Loader2,
  ExternalLink,
  XSquare // Added XSquare for the unselect icon
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import AddOptionModal from '@/components/AddOptionModal';
import AddOnForm from '@/components/AddOnForm';
import TrackingMailer from '@/components/TrackingMailer';
import EditJobFinancials from '@/components/EditJobFinancials';
import { toast } from 'sonner';

export default function SubmittalDetailClient({ submittal, options, addons, id, activeJob, initialDocuments }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Project Details State
  const [shippingAddress, setShippingAddress] = useState(submittal.shipping_address || 'Toilet Partitions shipping to ');
  const [description, setDescription] = useState(submittal.description || '** All hardware needed for installation is included **');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [docs, setDocs] = useState<any[]>(initialDocuments || []);
  const [isUploading, setIsUploading] = useState(false);

  // Modal States
  const [showAddOnForm, setShowAddOnForm] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false); 
  const [showTrackingMailer, setShowTrackingMailer] = useState(false);
  const [showEditFinancials, setShowEditFinancials] = useState(false);
  const [modalData, setModalData] = useState<any>(null); 
  
  const supabase = createClient();
  const router = useRouter();

  // NEW: Determine all winning IDs (falls back to legacy single ID for old records)
  const winningIds: any[] = activeJob?.winning_quote_ids || 
    (activeJob?.accepted_individual_quote ? [activeJob.accepted_individual_quote] : []);

  // NEW: Sum up all winning options
  const winnerPrice = options
    ?.filter((o: any) => winningIds.includes(o.id))
    .reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0) || 0;

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

  const handleAutoSave = async (field: 'shipping_address' | 'description', value: string) => {
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
      setTimeout(() => setSaveStatus('idle'), 2000); 
      router.refresh();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Upload to Supabase Storage bucket
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const filePath = `${id}/${Date.now()}_${safeName}`; 

      const { error: uploadError } = await supabase.storage
        .from('job_documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('job_documents')
        .getPublicUrl(filePath);

      // 3. Save reference to the database
      const { data: newDoc, error: dbError } = await supabase
        .from('job_documents')
        .insert({
          quote_id: id,
          file_name: file.name,
          file_url: publicUrl
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update UI immediately
      setDocs(prev => [newDoc, ...prev]);
      toast.success("Document uploaded!");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this document? This cannot be undone.")) return;
    
    const { error } = await supabase.from('job_documents').delete().eq('id', docId);
    
    if (error) {
      toast.error(error.message);
    } else {
      setDocs(docs.filter(d => d.id !== docId));
      toast.success("Document removed");
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
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      console.error("PDF Error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  // NEW: Updated Winner Toggling Logic
  const handleSelectWinner = async (option: any) => {
    const isCurrentlyWinner = winningIds.includes(option.id);
    
    // Determine the new array of winning IDs
    let newWinningIds: any[];
    if (isCurrentlyWinner) {
      newWinningIds = winningIds.filter((winId: any) => winId !== option.id);
    } else {
      newWinningIds = [...winningIds, option.id];
    }

    // Calculate the new total sale amount
    const newSaleAmount = options
      ?.filter((o: any) => newWinningIds.includes(o.id))
      .reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0) || 0;

    const confirmMsg = isCurrentlyWinner
      ? `Remove ${option.material} from winning bids? This updates the total to $${newSaleAmount.toLocaleString()}.`
      : `Add ${option.material} as a winning bid? This updates the total to $${newSaleAmount.toLocaleString()}.`;

    if (!confirm(confirmMsg)) return;
    setLoading(true);

    const { error: jobError } = await supabase
      .from('jobs')
      .upsert({
        quote_id: id, 
        accepted_individual_quote: newWinningIds.length > 0 ? newWinningIds[0] : null, // Fallback for legacy
        winning_quote_ids: newWinningIds, // New Array Column
        sale_amount: newSaleAmount,
        created_at: activeJob?.created_at || new Date().toISOString(),
      }, { 
        onConflict: 'quote_id' 
      });

    // Revert status to PENDING if no winners are selected
    const newStatus = newWinningIds.length > 0 ? 'WON' : 'PENDING';
    await supabase
      .from('quote_submittals')
      .update({ status: newStatus })
      .eq('id', id);

    if (!jobError) {
      toast.success(isCurrentlyWinner ? "Winner removed!" : "Winner added!");
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
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Hardware Info</label>
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
                setModalData(null);
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
            // NEW: Checks the array instead of the single string
            const isWinner = winningIds.includes(option.id);

            return (
              <div 
                key={option.id} 
                className={`bg-white border rounded-3xl p-6 shadow-sm transition flex justify-between items-center relative cursor-pointer group ${
                  isWinner ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-zinc-200 hover:border-blue-300'
                }`}
                onClick={() => toggleSelection(option.id)}
              >
                {isWinner && (
                  <div className="absolute -top-3 left-8 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-md uppercase tracking-widest z-10">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalData(option); 
                        setShowAddModal(true);
                      }}
                      className="p-2 text-zinc-300 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition border border-transparent hover:border-amber-100"
                      title="Edit Pricing Option"
                    >
                      <Edit3 size={20} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const { price, id: oldId, created_at, ...rest } = option; 
                        setModalData(rest);
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

                    {/* NEW: Toggling button logic */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWinner(option);
                      }}
                      disabled={loading}
                      className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-sm ${
                        isWinner 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100 group/btn' 
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-900 hover:text-white group/btn'
                      }`}
                    >
                      {isWinner ? (
                        <>
                          <CheckSquare size={14} className="group-hover/btn:hidden" />
                          <XSquare size={14} className="hidden group-hover/btn:block" />
                          <span className="group-hover/btn:hidden">Selected</span>
                          <span className="hidden group-hover/btn:block">Remove</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle size={14} />
                          Add Winner
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* SECTION 4: PROJECT DOCUMENTS */}
      <section className="pt-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black flex items-center gap-2 text-zinc-900 uppercase tracking-tight">
            <File size={22} className="text-blue-600" /> Associated Files
          </h2>
          
          <div>
            <input 
              type="file" 
              id="doc-upload" 
              accept="application/pdf" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            <label 
              htmlFor="doc-upload"
              className={`flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100 cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {isUploading ? <Loader2 className="animate-spin" size={14} /> : <UploadCloud size={14} />}
              {isUploading ? 'Uploading...' : 'Upload PDF'}
            </label>
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="bg-white border border-zinc-200 border-dashed rounded-[2.5rem] p-12 text-center text-zinc-400 font-bold uppercase text-xs tracking-widest">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {docs.map((doc: any) => (
              <div 
                key={doc.id} 
                onClick={() => window.open(doc.file_url, '_blank')}
                className="group cursor-pointer bg-white border border-zinc-200 rounded-3xl p-3 hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              >
                {/* Hover Overlay with Icon */}
                <div className="absolute inset-0 bg-blue-50/0 group-hover:bg-blue-50/80 transition-all z-10 flex items-center justify-center pointer-events-none">
                  <div className="opacity-0 group-hover:opacity-100 bg-blue-600 text-white p-3 rounded-full shadow-xl transition-all scale-75 group-hover:scale-100">
                    <ExternalLink size={20} />
                  </div>
                </div>

                {/* File Name */}
                <p className="text-xs font-black text-zinc-700 truncate mb-3 px-1 uppercase tracking-wider relative z-20" title={doc.file_name}>
                  {doc.file_name}
                </p>

                {/* Live PDF Preview via scaled iframe */}
                <div className="relative aspect-[3/4] w-full bg-white rounded-2xl overflow-hidden pointer-events-none ring-1 ring-inset ring-zinc-200/50">
                  <iframe 
                    src={`${doc.file_url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`} 
                    className="absolute top-0 left-0 w-[200%] h-[200%] origin-top-left scale-50 border-none" 
                    scrolling="no"
                    tabIndex={-1} 
                  />
                </div>

                {/* Delete Button */}
                <button 
                  onClick={(e) => handleDeleteDoc(doc.id, e)}
                  className="absolute top-2 right-2 p-1.5 bg-white text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition z-20 shadow-sm border border-zinc-200"
                  title="Remove Document"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL OVERLAYS */}
      {showAddModal && (
        <AddOptionModal 
          quoteId={id} 
          onClose={() => {
            setShowAddModal(false);
            setModalData(null);
          }} 
          initialData={modalData}
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