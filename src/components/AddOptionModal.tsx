'use client';

import { useState } from 'react';
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
  const router = useRouter();
  const supabase = createClient();
  const [manufacturer, setManufacturer] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    const { error } = await supabase
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

    if (error) {
      alert(error.message);
    } else {
      router.refresh(); // Refresh the Server Component data
      onClose(); // Close the modal
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b flex justify-between items-center bg-zinc-50">
          <h2 className="text-xl font-bold text-zinc-900">Add Material Option</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Material Name</label>
            <input name="material" required className="w-full p-2 border rounded-lg" placeholder="e.g. Solid Plastic" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Quantity</label>
              <input name="quantity" type="number" required className="w-full p-2 border rounded-lg" placeholder="29" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Price ($)</label>
              <input name="price" type="number" step="0.01" required className="w-full p-2 border rounded-lg" placeholder="17000" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Mounting Style</label>
            <input name="mounting_style" className="w-full p-2 border rounded-lg" placeholder="Floor Mounted" />
          </div>

          <div>
            <ManufacturerSelect 
              value={manufacturer} 
              onChange={(val) => setManufacturer(val)} 
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Option'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}