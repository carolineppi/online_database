'use client';

import { useState } from 'react';
import { Package, FileDown, CheckSquare, Square, FileText } from 'lucide-react';
import AddOptionTrigger from '@/components/AddOptionTrigger';
import SelectWinnerButton from '@/components/SelectWinnerButton';

export default function SubmittalDetailClient({ submittal, options, id }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

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
          {options?.map((option: any) => (
            <div 
              key={option.id} 
              className={`bg-white border rounded-xl p-5 shadow-sm transition flex justify-between items-center cursor-pointer ${
                selectedIds.includes(option.id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-200 hover:border-blue-300'
              }`}
              onClick={() => toggleSelection(option.id)}
            >
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
                <p className="text-2xl font-black text-zinc-900">
                  ${Number(option.price).toLocaleString()}
                </p>
                {!submittal.is_job && (
                  <div className="mt-2">
                    <SelectWinnerButton quoteId={id} optionId={option.id} price={option.price} />
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
  );
}