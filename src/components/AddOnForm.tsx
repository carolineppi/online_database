'use client';

import { useState } from 'react';
import { Plus, Trash2, Package, Truck, ShieldCheck, Palette, HelpCircle, ChevronDown, PlusCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const MATERIALS = ["Powder Coated Steel", "Stainless Steel", "Solid Plastic (HDPE)", "Phenolic Black Core", "Phenolic Color Thru"];
const MANUFACTURERS = ["Hadrian", "Bradley (Mills)", "Bobrick", "Scranton Products", "Global Partitions"];
const PRESET_ITEMS = ["Toilet Partitions", "Urinal Screens", "Privacy Screens", "Alcove Stalls", "In-Corner Stalls", "Shower Units"];

interface AddOnFormProps {
  quoteId: string;
  jobId?: string;
  onClose: () => void;
  initialData?: any;
}

export default function AddOnForm({ quoteId, jobId, onClose, initialData }: AddOnFormProps) {
  const [loading, setLoading] = useState(false);
  
  // Initialize items from initialData (for duplication/edit) or default
  const [items, setItems] = useState(
    initialData?.itemized_breakdown || [{ item: "Toilet Partitions", qty: 0 }]
  );
  
  const [formData, setFormData] = useState({
    material: initialData?.material || MATERIALS[0],
    manufacturer: initialData?.manufacturer || MANUFACTURERS[0],
    price: initialData?.price || '', 
    color: initialData?.color || '',
    mounting_style: initialData?.mounting_style || 'Floor Anchored / Overhead Braced',
    shipping_included: initialData?.shipping_included || 'Included',
    hardware_included: initialData?.hardware_included || 'All Standard Chrome Hardware Included',
    reason: initialData?.reason || '' // Specific "Reason" field
  });
  
  const supabase = createClient();
  const router = useRouter();

  const addItemRow = () => setItems([...items, { item: "", qty: 1 }]);
  const removeItemRow = (index: number) => setItems(items.filter((_: any, i: number) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('add_ons').insert({
      quote_id: quoteId,
      job_id: jobId || null,
      ...formData,
      itemized_breakdown: items,
      quantity: items.reduce((sum: number, i: any) => sum + (Number(i.qty) || 0), 0)
    });

    if (!error) {
      toast.success("Add-on successfully added!");
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
              <PlusCircle className="text-emerald-600" size={28} /> 
              Add New Material (Add-on)
            </h2>
            <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition">✕</button>
          </div>

          <div className="space-y-6">
            {/* 1. Material & Manufacturer Selects */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Material</label>
                <div className="relative">
                  <select required value={formData.material} className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition appearance-none font-bold text-zinc-900"
                    onChange={e => setFormData({...formData, material: e.target.value})}>
                    {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Manufacturer</label>
                <div className="relative">
                  <select required value={formData.manufacturer} className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition appearance-none font-bold text-zinc-900"
                    onChange={e => setFormData({...formData, manufacturer: e.target.value})}>
                    {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            {/* 2. Style and Color */}
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
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Color</label>
                <div className="relative">
                  <Palette className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input required value={formData.color} placeholder="Color Name/Code" className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition font-bold"
                    onChange={e => setFormData({...formData, color: e.target.value})} />
                </div>
              </div>
            </div>

            {/* 3. Reason Field (Unique to Add-On Form) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Reason for Add-on</label>
              <div className="relative">
                <HelpCircle className="absolute left-4 top-4 text-zinc-400" size={18} />
                <textarea 
                  required 
                  placeholder="e.g. Additional urinal screens requested by customer" 
                  className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-medium min-h-[80px]"
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})} 
                />
              </div>
            </div>

            {/* 4. Price & Shipping Select */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Add-on Price</label>
                <input required type="number" step="0.01" value={formData.price} placeholder="0.00" className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition font-bold text-emerald-600"
                  onChange={e => setFormData({...formData, price: e.target.value})} />
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

            {/* 5. Hardware Details */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Hardware Details</label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input required value={formData.hardware_included} className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition font-bold"
                  onChange={e => setFormData({...formData, hardware_included: e.target.value})} />
              </div>
            </div>

            {/* 6. Itemized Breakdown */}
            <div className="bg-zinc-100 p-6 rounded-[2rem] border border-zinc-200">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Itemized Breakdown</p>
              
              <datalist id="addon-preset-items">
                {PRESET_ITEMS.map(item => <option key={item} value={item} />)}
              </datalist>

              <div className="space-y-3">
                {items.map((row: any, index: number) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input 
                      list="addon-preset-items"
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
            <button type="submit" disabled={loading} className="flex-1 p-5 bg-zinc-900 text-white rounded-2xl font-black hover:bg-emerald-600 transition uppercase tracking-widest text-[10px] shadow-xl shadow-zinc-200">
              {loading ? "Adding..." : "Confirm Add-on"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}