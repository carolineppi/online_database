'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { DollarSign, X } from 'lucide-react';
import { toast } from 'sonner';

export default function EditJobFinancials({ job, onClose }: { job: any, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const estCost = Number(formData.get('estimated_cost'));

    const { error } = await supabase
      .from('jobs')
      .update({ estimated_cost: estCost })
      .eq('id', job.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Financials updated!");
      router.refresh();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full shadow-2xl p-8 animate-in slide-in-from-right">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Edit Job Financials</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-zinc-500 uppercase mb-2">Contract Value (Sale)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input 
                disabled 
                value={job.sale_amount} 
                className="w-full pl-10 p-3 bg-zinc-50 border rounded-lg text-zinc-500 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1">Contract value is locked from the winning quote.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-700 uppercase mb-2">Estimated Vendor Cost</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input 
                name="estimated_cost"
                type="number"
                step="0.01"
                defaultValue={job.estimated_cost}
                className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-zinc-900 text-white py-4 rounded-xl font-bold hover:bg-zinc-800 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Save Financial Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}