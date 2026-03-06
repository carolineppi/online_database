'use client';

import { useState } from 'react';
import { Plus, Trash2, Package, Truck, ShieldCheck, Palette } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Extracted from your legacy SQL "quantity" column
const PRESET_ITEMS = [
  "Toilet Partitions",
  "Urinal Screens",
  "Privacy Screens",
  "Alcove Stalls",
  "In-Corner Stalls",
  "Shower Units",
  "Changing Room Stalls",
  "Vanity Tops"
];

export default function AddOptionModal({ quoteId, onClose }: { quoteId: string, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  
  // Always starts with Toilet Partitions: 0
  const [items, setItems] = useState([{ item: "Toilet Partitions", qty: 0 }]);
  
  const [formData, setFormData] = useState({
    material: '',
    manufacturer: '',
    price: '',
    color: '',
    mounting_style: 'Floor Anchored / Overhead Braced',
    shipping_included: 'Included',
    hardware_included: 'All Standard Chrome Hardware Included'
  });
  
  const supabase = createClient();
  const router = useRouter();

  const addItemRow = () => setItems([...items, { item: "", qty: 1 }]);
  const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('individual_quotes').insert({
      quote_id: quoteId,
      ...formData,
      itemized_breakdown: items,
      quantity: items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0)
    });

    if (!error) {
      toast.success("Quote option added!");
      router.refresh();
      onClose();
    } else {
      toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-y-auto max-h-[90vh] shadow-2xl">
        <form onSubmit={handleSubmit} className="p-10">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-zinc-900 uppercase flex items-center gap-3">
              <Package className="text-blue-600" size={28} /> Add Quote Option
            </h2>
            <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition">✕</button>
          </div>

          <div className="space-y-6">
            {/* Input fields for Material, Manufacturer, Mounting, Color, Price, Shipping, Hardware */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Material</label>
                <input required placeholder="Material" className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition"
                  onChange={e => setFormData({...formData, material: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Manufacturer</label>
                <input required placeholder="Manufacturer" className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition"
                  onChange={e => setFormData({...formData, manufacturer: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Mounting Style</label>
                <select className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition appearance-none"
                  value={formData.mounting_style}
                  onChange={e => setFormData({...formData, mounting_style: e.target.value})}>
                  <option>Floor Anchored / Overhead Braced</option>
                  <option>Floor to Ceiling Anchored</option>
                  <option>Ceiling Hung</option>
                  <option>Floor Anchored</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Color</label>
                <div className="relative">
                  <Palette className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input required placeholder="Color" className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition"
                    onChange={e => setFormData({...formData, color: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Price</label>
                <input required type="number" step="0.01" placeholder="Price $" className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition"
                  onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Shipping</label>
                <div className="relative">
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input required placeholder="e.g. Included" defaultValue="Included" className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition"
                    onChange={e => setFormData({...formData, shipping_included: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Hardware Details</label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input required placeholder="Hardware" defaultValue="All Standard Chrome Hardware Included" className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition"
                  onChange={e => setFormData({...formData, hardware_included: e.target.value})} />
              </div>
            </div>

            {/* Item + Quantity List Section with Combobox */}
            <div className="bg-zinc-100 p-6 rounded-[2rem] border border-zinc-200">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Breakdown of Items</p>
              
              {/* DataList for searchable dropdown */}
              <datalist id="preset-items">
                {PRESET_ITEMS.map(item => (
                  <option key={item} value={item} />
                ))}
              </datalist>

              <div className="space-y-3">
                {items.map((row, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input 
                      list="preset-items" // Connects to datalist above
                      placeholder="Type or select item..."
                      className="flex-grow p-4 bg-white rounded-xl border border-zinc-200 text-sm font-bold shadow-sm"
                      value={row.item}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].item = e.target.value;
                        setItems(newItems);
                      }}
                    />
                    <input 
                      type="number" 
                      placeholder="Qty"
                      className="w-24 p-4 bg-white rounded-xl border border-zinc-200 text-sm font-bold text-center shadow-sm"
                      value={row.qty}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].qty = parseInt(e.target.value) || 0;
                        setItems(newItems);
                      }}
                    />
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItemRow(index)} className="p-2 text-zinc-400 hover:text-red-500 transition">
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItemRow} className="mt-4 flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition">
                <Plus size={14} /> Add Another Item
              </button>
            </div>
          </div>

          <div className="flex gap-4 mt-10">
            <button type="button" onClick={onClose} className="flex-1 p-5 rounded-2xl font-black text-zinc-500 hover:bg-zinc-100 transition uppercase tracking-widest text-[10px]">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 p-5 bg-zinc-900 text-white rounded-2xl font-black hover:bg-blue-600 transition uppercase tracking-widest text-[10px] shadow-xl shadow-zinc-200">
              {loading ? "Processing..." : "Add to Proposal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}