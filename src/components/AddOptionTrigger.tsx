'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import ManufacturerSelect from './ManufacturerSelect';

interface AddOptionModalProps {
  quoteId: string;
  onClose: () => void;
}

export default function AddOptionModal({ quoteId, onClose }: AddOptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();
  const [manufacturer, setManufacturer] = useState('');

  // Retrieve logged-in employee info
  useEffect(() => {
    const saved = localStorage.getItem('employee');
    if (saved) setEmployee(JSON.parse(saved));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    // 1. Check current count of existing options for this submittal
    const { count } = await supabase
      .from('individual_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('quote_id', quoteId);

    // 2. Insert the Material Option
    const { error: insertError } = await supabase
      .from('individual_quotes')
      .insert([
        {
          quote_id: quoteId,
          material: formData.get('material'),
          mounting_style: formData.get('mounting_style'),
          quantity: formData.get('quantity'),
          manufacturer: manufacturer,
          price: formData.get('price'),
          color: 'TBD',
          shipping_area: 'Includes Shipping',
        },
      ]);

    if (insertError) {
      alert("Error saving option: " + insertError.message);
      setLoading(false);
      return;
    }

    // 3. Conditional Quote Number Update
    // Only if this is the FIRST quote and we have a logged-in employee
    if (count === 0 && employee?.name_code) {
      const { data: submittal } = await supabase
        .from('quote_submittals')
        .select('quote_number')
        .eq('id', quoteId)
        .single();

      // Only append if the number is exactly 5 digits (prevents double-appending)
      if (submittal && submittal.quote_number.length === 5) {
        await supabase
          .from('quote_submittals')
          .update({ 
            quote_number: submittal.quote_number + employee.name_code,
            status: 'Quoted' 
          })
          .eq('id', quoteId);
      }
    } else {
      // Just update status if not the first quote
      await supabase
        .from('quote_submittals')
        .update({ status: 'Quoted' })
        .eq('id', quoteId);
    }

    router.refresh(); 
    onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200">
        <div className="p-6 border-b flex justify-between items-center bg-zinc-50/50">
          <div>
            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">Add Option</h2>
            {employee && (
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                Estimator: {employee.first_name} ({employee.name_code})
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1 ml-1">Material Description</label>
            <input name="material" required className="w-full p-3 border rounded-xl bg-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="e.g. Solid Plastic" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1 ml-1">Quantity</label>
              <input name="quantity" type="number" required className="w-full p-3 border rounded-xl bg-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1 ml-1">Price ($)</label>
              <input name="price" type="number" step="0.01" required className="w-full p-3 border rounded-xl bg-zinc-50 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1 ml-1">Mounting Style</label>
            <input name="mounting_style" className="w-full p-3 border rounded-xl bg-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="Floor Mounted" />
          </div>

          <div>
            <ManufacturerSelect 
              value={manufacturer} 
              onChange={(val) => setManufacturer(val)} 
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="submit" disabled={loading} className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition disabled:opacity-50">
              {loading ? 'Processing...' : 'Confirm & Save Option'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}