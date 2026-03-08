'use client';

import { useState } from 'react';
import { Plus, Trash2, Package, Truck, ShieldCheck, Palette, HelpCircle, ChevronDown, PlusCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const MATERIALS = ["Powder Coated Steel (PCS)", "High Pressure Laminate (HPL)", "HDPE Solid Plastic", "Solid Phenolic", "Stainless Steel" ];
const MANUFACTURERS = ["ASI", "Bobrick", "Bradley", "Excel", "Global", "Hadrian", "Hawa", "Metpar", "Partition Plus", "Scranton Products"];
const PRESET_ITEMS = ["Toilet Partitions", "Urinal Screens", "Privacy Screens", "Alcove Stalls", "In-Corner Stalls", "Shower Units"];

interface AddOnFormProps {
  quoteId: string; // The primary link for the add-on
  onClose: () => void;
  initialData?: any;
}

export default function AddOnForm({ quoteId, onClose, initialData }: AddOnFormProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  
  const [items, setItems] = useState(
    initialData?.itemized_breakdown || [{ item: "Toilet Partitions", qty: 0 }]
  );
  
  const [formData, setFormData] = useState({
    material: initialData?.material || MATERIALS[0],
    manufacturer: initialData?.manufacturer || MANUFACTURERS[0],
    price: initialData?.price || '', 
    color: initialData?.color || '',
    mounting_style: initialData?.mounting_style || 'Floor Mounted / Overhead Braced',
    shipping_included: initialData?.shipping_included || 'Includes Shipping',
    hardware_included: initialData?.hardware_included || 'All Hardware Needed for Installation is Included',
    reason: initialData?.reason || '' 
  });

  const addItemRow = () => setItems([...items, { item: "", qty: 1 }]);
  const removeItemRow = (index: number) => setItems(items.filter((_: any, i: number) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Correctly targeting 'quote_id' instead of 'job_id'
    const { error } = await supabase.from('add_ons').insert({
      quote_id: quoteId, 
      ...formData,
      itemized_breakdown: items,
      quantity: items.reduce((sum: number, i: any) => sum + (Number(i.qty) || 0), 0)
    });

    if (!error) {
      toast.success("Add-on successfully saved to this submittal");
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
            {/* Form Fields: Material, Manufacturer, Mounting Style, Color */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Material</label>
                <div className="relative">
                  <select value={formData.material} className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition appearance-none font-bold text-zinc-900"
                    onChange={e => setFormData({...formData, material: e.target.value})}>
                    {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Manufacturer</label>
                <div className="relative">
                  <select value={formData.manufacturer} className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition appearance-none font-bold text-zinc-900"
                    onChange={e => setFormData({...formData, manufacturer: e.target.value})}>
                    {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Mounting Style</label>
                <div className="relative">
                  <select className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition appearance-none font-bold text-zinc-900"
                    value={formData.mounting_style}
                    onChange={e => setFormData({...formData, mounting_style: e.target.value})}>
                    <option>Floor Mounted / Overhead Braced</option>
                    <option>Floor Mounted Only</option>
                    <option>Ceiling Hung</option>
                    <option>Floor to Ceiling Mounted</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Color</label>
                <div className="relative">
                  <Palette className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input value={formData.color} placeholder="Color Name" className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-bold"
                    onChange={e => setFormData({...formData, color: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Reason for Add-on */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Reason for Add-on</label>
              <div className="relative">
                <HelpCircle className="absolute left-4 top-4 text-zinc-400" size={18} />
                <textarea  
                  placeholder="Why is this material being added?" 
                  className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-medium min-h-[80px]"
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})} 
                />
              </div>
            </div>

            {/* Price & Shipping */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Price</label>
                <input required type="number" step="0.01" value={formData.price} placeholder="0.00" className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-bold text-emerald-600"
                  onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Shipping</label>
                <div className="relative">
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <select className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition appearance-none font-bold text-zinc-900"
                    value={formData.shipping_included}
                    onChange={e => setFormData({...formData, shipping_included: e.target.value})}>
                    <option value="Shipping Only">Includes Shipping</option>
                    <option value="Shipping & Sales Tax">Includes Shipping & Sales Tax</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            {/* Hardware Inclusion */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Hardware Details</label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input value={formData.hardware_included} className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-bold"
                  onChange={e => setFormData({...formData, hardware_included: e.target.value})} />
              </div>
            </div>

            {/* Searchable Item List */}
            <div className="bg-zinc-100 p-6 rounded-[2rem] border border-zinc-200">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Itemized Breakdown</p>
              
              <datalist id="addon-search-items">
                {PRESET_ITEMS.map(item => <option key={item} value={item} />)}
              </datalist>

              <div className="space-y-3">
                {items.map((row: any, index: number) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input 
                      list="addon-search-items"
                      placeholder="Select item..."
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