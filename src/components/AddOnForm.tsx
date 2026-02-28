'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { PlusCircle, Package, X, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ManufacturerSelect from './ManufacturerSelect';

export default function AddOnForm({ jobId, quoteId, onClose }: { jobId: string, quoteId: string, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const [manufacturer, setManufacturer] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      quote_id: quoteId, // Linked to the original quote via ID '1' in your SQL
      material: formData.get('material'),
      mounting_style: formData.get('mounting_style'),
      quantity: formData.get('quantity'),
      color: formData.get('color'),
      price: Number(formData.get('price')),
      manufacturer: manufacturer,
      shipping_area: formData.get('shipping_area'),
      reason: formData.get('reason'),
    };

    const { error } = await supabase.from('add_ons').insert([payload]);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Post-sale material added!");
      router.refresh();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-zinc-200">
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div>
            <h3 className="font-bold text-xl text-zinc-900">Add Post-Sale Material</h3>
            <p className="text-sm text-zinc-500">Appending new items to Quote #{quoteId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition"><X size={20}/></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Material Description</label>
            <input name="material" placeholder="e.g., HinyHiders Solid Plastic..." className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Mounting Style</label>
            <input name="mounting_style" placeholder="Floor Mounted..." className="w-full p-3 border rounded-xl" />
          </div>

          <div>
            <ManufacturerSelect 
              value={manufacturer} 
              onChange={(val) => setManufacturer(val)} 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Quantity Details</label>
            <input name="quantity" placeholder="(1) 36x55 door..." className="w-full p-3 border rounded-xl" />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Color / Finish</label>
            <input name="color" placeholder="Charcoal Grey OP..." className="w-full p-3 border rounded-xl" />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Add-on Price (Sale)</label>
            <input name="price" type="number" placeholder="905" className="w-full p-3 border rounded-xl font-bold text-zinc-900" required />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1"><Truck size={12}/> Shipping Info</label>
            <input name="shipping_area" placeholder="Includes Shipping..." className="w-full p-3 border rounded-xl" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Reason for Add-on</label>
            <textarea name="reason" placeholder="Customer requested extra door latch..." className="w-full p-3 border rounded-xl h-20 outline-none" />
          </div>

          <div className="md:col-span-2 pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <PlusCircle size={20} />
              {loading ? 'Processing...' : 'Record Add-on Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}