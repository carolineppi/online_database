'use client';

import { useState } from 'react';
import { Package, FileDown, CheckSquare, Square, Trophy, RefreshCcw } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import AddOptionTrigger from '@/components/AddOptionTrigger';

// We now accept activeJob to track the current winner and job details
export default function SubmittalDetailClient({ submittal, options, id, activeJob }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const toggleSelection = (optionId: string) => {
    setSelectedIds(prev => 
      prev.includes(optionId) ? prev.filter(i => i !== optionId) : [...prev, optionId]
    );
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

  // Logic to handle selecting or changing the winning quote option
  const handleSelectWinner = async (option: any) => {
    const confirmMsg = activeJob 
      ? `Change winner to ${option.material}? This will update the job's sale amount to $${Number(option.price).toLocaleString()}.`
      : `Mark ${option.material} as the winner and create a job?`;

    if (!confirm(confirmMsg)) return;
    setLoading(true);

    // Update the 'jobs' table and ensure the submittal status reflects the win
    const { error: jobError } = await supabase
      .from('jobs')
      .upsert({
        submittal_id: id,
        winning_option_id: option.id,
        total_price: option.price,
        created_at: activeJob?.created_at || new Date().toISOString(),
      }, { onConflict: 'submittal_id' });

    await supabase
      .from('quote_submittals')
      .update({ status: 'WON' })
      .eq('id', id);

    if (!jobError) {
      router.refresh(); // Update UI to show the new winner badge
    } else {
      alert("Error updating winner: " + jobError.message);
    }
    setLoading(false);
  };

  return (
    <div className="lg:col-span-2 space-y-6">
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-zinc-800">
            <Package size={20} className="text-zinc-400" /> Material Options
          </h2>
          <div className="flex gap-3">
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
            const isWinner = activeJob?.winning_option_id === option.id;

            return (
              <div 
                key={option.id} 
                className={`bg-white border rounded-xl p-5 shadow-sm transition flex justify-between items-center cursor-pointer relative ${
                  isWinner ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-zinc-200 hover:border-blue-300'
                }`}
                onClick={() => toggleSelection(option.id)}
              >
                {/* Winner Badge */}
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

                <div className="text-right" onClick={(e) => e.stopPropagation()}>
                  <p className={`text-2xl font-black ${isWinner ? 'text-emerald-600' : 'text-zinc-900'}`}>
                    ${Number(option.price).toLocaleString()}
                  </p>
                  
                  {/* Select/Change Winner Button */}
                  <button
                    onClick={() => handleSelectWinner(option)}
                    disabled={loading || isWinner}
                    className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition w-full justify-center ${
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
            );
          })}

          {options?.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400">
              No material options created yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}