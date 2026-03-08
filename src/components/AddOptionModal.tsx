'use client';

import { useState } from 'react';
import { Plus, Trash2, Package, Truck, ShieldCheck, Palette, ChevronDown } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const MATERIALS = ["Powder Coated Steel", "Stainless Steel", "Solid Plastic (HDPE)", "Phenolic Black Core", "Phenolic Color Thru"];
const MANUFACTURERS = ["Hadrian", "Bradley (Mills)", "Bobrick", "Scranton Products", "Global Partitions"];
const PRESET_ITEMS = ["Toilet Partitions", "Urinal Screens", "Privacy Screens", "Alcove Stalls", "In-Corner Stalls", "Shower Units"];

interface AddOptionModalProps {
  quoteId: string;
  onClose: () => void;
  initialData?: any;
}

export default function AddOptionModal({ quoteId, onClose, initialData }: AddOptionModalProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  
  const [items, setItems] = useState(
    initialData?.itemized_breakdown || [{ item: "Toilet Partitions", qty: 0 }]
  );
  
  const [formData, setFormData] = useState({
    material: initialData?.material || MATERIALS[0],
    manufacturer: initialData?.manufacturer || MANUFACTURERS[0],
    price: '', 
    color: initialData?.color || '',
    mounting_style: initialData?.mounting_style || 'Floor Anchored / Overhead Braced',
    shipping_included: initialData?.shipping_included || 'Included',
    hardware_included: initialData?.hardware_included || 'All Standard Chrome Hardware Included'
  });

  const addItemRow = () => setItems([...items, { item: "", qty: 1 }]);
  const removeItemRow = (index: number) => 
    setItems(items.filter((_: any, i: number) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    // 1. Fetch current quote count before inserting
    const { count, error: countError } = await supabase
      .from('individual_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('quote_id', quoteId)
      .is('deleted_at', null);

    if (countError) throw countError;

    // 2. Insert the new quote option
    const { error: insertError } = await supabase.from('individual_quotes').insert({
      quote_id: quoteId,
      ...formData,
      itemized_breakdown: items,
      quantity: items.reduce((sum: number, i: any) => sum + (Number(i.qty) || 0), 0)
    });

    if (insertError) throw insertError;

    // 3. Suffix Logic: Only if this is the first quote
    if (count === 0) {
      // Get the authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Fetch name_code from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name_code')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.name_code) {
        // Fetch current quote number to append suffix
        const { data: submittal } = await supabase
          .from('quote_submittals')
          .select('quote_number')
          .eq('id', quoteId)
          .single();

        // Check if suffix already exists to prevent double appending
        if (submittal && !submittal.quote_number.endsWith(profile.name_code)) {
          const finalQuoteNumber = `${submittal.quote_number}${profile.name_code}`;
          
          await supabase
            .from('quote_submittals')
            .update({ quote_number: finalQuoteNumber })
            .eq('id', quoteId);
        }
      }
    }

    toast.success("Quote successfully updated!");
    router.refresh();
    onClose();
  } catch (err: any) {
    console.error("Supabase Error:", err.message);
    toast.error(`Database Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-y-auto max-h-[90vh] shadow-2xl">
        <form onSubmit={handleSubmit} className="p-10">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-zinc-900 uppercase flex items-center gap-3">
              <Package className="text-blue-600" size={28} /> 
              {initialData ? "Duplicate Quote Option" : "Add Quote Option"}
            </h2>
            <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition">✕</button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Material</label>
                <div className="relative">
                  <select value={formData.material} className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition appearance-none font-bold text-zinc-900"
                    onChange={e => setFormData({...formData, material: e.target.value})}>
                    {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Manufacturer</label>
                <div className="relative">
                  <select value={formData.manufacturer} className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition appearance-none font-bold text-zinc-900"
                    onChange={e => setFormData({...formData, manufacturer: e.target.value})}>
                    {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest text-blue-600">Price (Required)</label>
                <input required type="number" step="0.01" value={formData.price} placeholder="0.00" className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-2 ring-blue-100 focus:ring-2 focus:ring-blue-500 transition font-bold text-blue-600"
                  onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Color</label>
                <div className="relative">
                  <Palette className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input value={formData.color} placeholder="Optional" className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition font-bold"
                    onChange={e => setFormData({...formData, color: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Mounting Style</label>
                <div className="relative">
                  <select className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition appearance-none font-bold text-zinc-900"
                    value={formData.mounting_style}
                    onChange={e => setFormData({...formData, mounting_style: e.target.value})}>
                    <option>Floor Anchored / Overhead Braced</option>
                    <option>Floor to Ceiling Anchored</option>
                    <option>Ceiling Hung</option>
                    <option>Floor Anchored</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Shipping Status</label>
                <div className="relative">
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <select className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition appearance-none font-bold text-zinc-900"
                    value={formData.shipping_included}
                    onChange={e => setFormData({...formData, shipping_included: e.target.value})}>
                    <option value="Included">Shipping Included</option>
                    <option value="Plus Shipping">Plus Shipping</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Hardware Details</label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input value={formData.hardware_included} className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition font-bold"
                  onChange={e => setFormData({...formData, hardware_included: e.target.value})} />
              </div>
            </div>

            <div className="bg-zinc-100 p-6 rounded-[2rem] border border-zinc-200">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Itemized Breakdown</p>
              
              <datalist id="preset-items">
                {PRESET_ITEMS.map(item => <option key={item} value={item} />)}
              </datalist>

              <div className="space-y-3">
                {items.map((row: any, index: number) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input 
                      list="preset-items"
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
              {loading ? "Processing..." : (initialData ? "Duplicate Quote" : "Add to Proposal")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}