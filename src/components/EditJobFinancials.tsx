'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { DollarSign, X, Package, Calculator } from 'lucide-react';
import { toast } from 'sonner';

export default function EditJobFinancials({ job, options, onClose }: { job: any, options: any[], onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [costs, setCosts] = useState<Record<string, string>>({});
  
  const router = useRouter();
  const supabase = createClient();

  // Find all winning options
  const winningIds = job.winning_quote_ids || (job.accepted_individual_quote ? [job.accepted_individual_quote] : []);
  const winningOptions = options?.filter(o => winningIds.includes(o.id)) || [];

  // Populate initial state from the database
  useEffect(() => {
    const initialCosts: Record<string, string> = {};
    winningOptions.forEach(opt => {
      initialCosts[opt.id] = opt.estimated_cost?.toString() || '';
    });
    setCosts(initialCosts);
  }, [options]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      let totalCost = 0;

      // 1. Update the cost for each individual quote
      const promises = Object.entries(costs).map(async ([optId, costStr]) => {
        const costVal = Number(costStr) || 0;
        totalCost += costVal;
        
        const { error } = await supabase
          .from('individual_quotes')
          .update({ estimated_cost: costVal })
          .eq('id', optId);
        
        if (error) throw error;
      });

      await Promise.all(promises);

      // 2. Update the master job record with the grand total so legacy reporting still works
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ estimated_cost: totalCost })
        .eq('id', job.id);

      if (jobError) throw jobError;

      toast.success("Financials updated successfully!");
      router.refresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update financials");
    } finally {
      setLoading(false);
    }
  };

  const handleCostChange = (id: string, val: string) => {
    setCosts(prev => ({ ...prev, [id]: val }));
  };

  // Calculations for the footer summary
  const totalSale = winningOptions.reduce((sum, opt) => sum + (Number(opt.price) || 0), 0);
  const totalCostCalc = Object.values(costs).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const totalMargin = totalSale - totalCostCalc;
  const marginPercentage = totalSale > 0 ? ((totalMargin / totalSale) * 100).toFixed(1) : '0.0';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
        
        {/* Header */}
        <div className="flex justify-between items-center p-8 border-b border-zinc-100 bg-zinc-50/50">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">Job Costing</h2>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Breakdown by Option</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded-full transition"><X /></button>
        </div>

        {/* Scrollable Form Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {winningOptions.length === 0 && (
            <p className="text-zinc-500 italic text-sm text-center">No winning options selected yet.</p>
          )}

          {winningOptions.map((opt, index) => (
            <div key={opt.id} className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl relative">
              <div className="absolute -top-3 left-4 bg-zinc-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-md">
                <Package size={10} /> Option {index + 1}
              </div>

              <div className="mt-3 mb-4">
                <p className="font-bold text-zinc-900">{opt.material}</p>
                <p className="text-xs text-zinc-500 font-medium">Sale Price: <span className="text-emerald-600 font-bold">${Number(opt.price).toLocaleString()}</span></p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Vendor Cost</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={costs[opt.id] || ''}
                    onChange={(e) => handleCostChange(opt.id, e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 p-4 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-bold text-zinc-900"
                    required
                  />
                </div>
              </div>
            </div>
          ))}

        </form>

        {/* Sticky Footer Summary & Save Button */}
        <div className="p-8 border-t border-zinc-100 bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
          
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
            <Calculator size={14} /> Financial Summary
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Sale</p>
              <p className="text-lg font-black text-emerald-600">${totalSale.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Cost</p>
              <p className="text-lg font-black text-amber-600">${totalCostCalc.toLocaleString()}</p>
            </div>
          </div>

          <button 
            onClick={(e) => { e.preventDefault(); handleSubmit(e as any); }}
            disabled={loading || winningOptions.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 transition shadow-xl shadow-zinc-200 disabled:opacity-50"
          >
            {loading ? 'Saving Costs...' : 'Save Financials'}
          </button>
        </div>

      </div>
    </div>
  );
}