'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { DollarSign, X, Package, Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditJobFinancials({ job, options: passedOptions, onClose }: { job: any, options?: any[], onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!passedOptions); 
  const [options, setOptions] = useState<any[]>(passedOptions || []);
  
  // Track both costs separately
  const [actualCosts, setActualCosts] = useState<Record<string, string>>({});
  const [estimatedCosts, setEstimatedCosts] = useState<Record<string, string>>({});
  
  const router = useRouter();
  const supabase = createClient();

  // Fetch options if opened from the Jobs page
  useEffect(() => {
    if (!passedOptions) {
      const fetchOptions = async () => {
        setFetching(true);
        const { data } = await supabase
          .from('individual_quotes')
          .select('*')
          .eq('quote_id', job.quote_id);
        
        if (data) setOptions(data);
        setFetching(false);
      };
      fetchOptions();
    }
  }, [job.quote_id, passedOptions, supabase]);

  // Find all winning options
  const winningIds = job.winning_quote_ids || (job.accepted_individual_quote ? [job.accepted_individual_quote] : []);
  const winningOptions = options?.filter(o => winningIds.includes(o.id)) || [];

  // Populate initial state from the database
  useEffect(() => {
    const initialActual: Record<string, string> = {};
    const initialEst: Record<string, string> = {};
    
    winningOptions.forEach(opt => {
      initialActual[opt.id] = opt.actual_cost?.toString() || '';
      initialEst[opt.id] = opt.estimated_cost?.toString() || '';
    });
    
    setActualCosts(initialActual);
    setEstimatedCosts(initialEst);
  }, [options]); 

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      let totalActualCost = 0;
      let totalEstCost = 0;

      // 1. Update both costs for each individual quote
      const promises = winningOptions.map(async (opt) => {
        const actualVal = Number(actualCosts[opt.id]) || 0;
        const estVal = Number(estimatedCosts[opt.id]) || 0;
        
        totalActualCost += actualVal;
        totalEstCost += estVal;
        
        const { error } = await supabase
          .from('individual_quotes')
          .update({ 
            actual_cost: actualVal,
            estimated_cost: estVal 
          })
          .eq('id', opt.id);
        
        if (error) throw error;
      });

      await Promise.all(promises);

      // 2. Update the master job record with both grand totals
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ 
          actual_cost: totalActualCost,
          estimated_cost: totalEstCost 
        })
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

  const handleActualCostChange = (id: string, val: string) => {
    setActualCosts(prev => ({ ...prev, [id]: val }));
  };

  const handleEstCostChange = (id: string, val: string) => {
    setEstimatedCosts(prev => ({ ...prev, [id]: val }));
  };

  // Calculations for the footer summary
  const totalSale = winningOptions.reduce((sum, opt) => sum + (Number(opt.price) || 0), 0);
  const totalActualCalc = Object.values(actualCosts).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const totalEstCalc = Object.values(estimatedCosts).reduce((sum, val) => sum + (Number(val) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
        
        {/* Header */}
        <div className="flex justify-between items-center p-8 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">Job Costing</h2>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Breakdown by Option</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded-full transition"><X /></button>
        </div>

        {/* Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {fetching ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3">
              <Loader2 className="animate-spin" size={24} />
              <p className="text-xs font-bold uppercase tracking-widest">Loading options...</p>
            </div>
          ) : (
            <form id="financials-form" onSubmit={handleSubmit} className="space-y-8">
              
              {winningOptions.length === 0 && (
                <p className="text-zinc-500 italic text-sm text-center">No winning options selected yet.</p>
              )}

              {winningOptions.map((opt, index) => (
                <div key={opt.id} className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl relative">
                  <div className="absolute -top-3 left-4 bg-zinc-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-md">
                    <Package size={10} /> Option {index + 1}
                  </div>

                  <div className="mt-3 mb-5">
                    <p className="font-bold text-zinc-900">{opt.material}</p>
                    <p className="text-xs text-zinc-500 font-medium">Sale Price: <span className="text-emerald-600 font-bold">${Number(opt.price).toLocaleString()}</span></p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Estimated Cost Input (New Concept) */}
                    <div>
                      <label className="block text-[9px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Estimated Cost</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={estimatedCosts[opt.id] || ''}
                          onChange={(e) => handleEstCostChange(opt.id, e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 p-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-bold text-zinc-900 text-sm"
                        />
                      </div>
                    </div>
                    {/* Actual Vendor Cost Input (Existing Concept) */}
                    <div>
                      <label className="block text-[9px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Actual Cost</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={actualCosts[opt.id] || ''}
                          onChange={(e) => handleActualCostChange(opt.id, e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 p-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-bold text-zinc-900 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </form>
          )}
        </div>

        {/* Sticky Footer Summary & Save Button */}
        <div className="p-8 border-t border-zinc-100 bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] shrink-0">
          
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
            <Calculator size={14} /> Financial Summary
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 truncate">Total Sale</p>
              <p className="text-base font-black text-emerald-600">${totalSale.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 truncate">Total Est.</p>
              <p className="text-base font-black text-blue-600">${totalEstCalc.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1 truncate">Total Actual</p>
              <p className="text-base font-black text-amber-600">${totalActualCalc.toLocaleString()}</p>
            </div>

          </div>

          <button 
            type="submit"
            form="financials-form"
            disabled={loading || winningOptions.length === 0 || fetching}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 transition shadow-xl shadow-zinc-200 disabled:opacity-50"
          >
            {loading ? 'Saving Costs...' : 'Save Financials'}
          </button>
        </div>

      </div>
    </div>
  );
}