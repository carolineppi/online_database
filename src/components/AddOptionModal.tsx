'use client';

import { useState } from 'react';
import { Plus, Trash2, Package, Truck, ShieldCheck, Palette, ChevronDown } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Extracted from legacy SQL data
const MATERIALS = ["Powder Coated Steel (PCS)", "High Pressure Laminate (HPL)", "HDPE Solid Plastic", "Solid Phenolic", "Stainless Steel", "Accessories Only" ];
const MANUFACTURERS = ["ASI", "Bobrick", "Bradley", "Excel", "Global", "Hadrian", "Hawa", "Metpar", "Partition Plus", "Scranton Products"];
const PRESET_ITEMS = ["Toilet Partitions", "Urinal Screens", "Privacy Screens", "Alcove Stalls", "In-Corner Stalls", "Shower Units"];

interface AddOptionModalProps {
  quoteId: string;
  onClose: () => void;
  initialData?: any;
}
interface QuoteItem {
  item: string;
  qty: number;
}

export default function AddOptionModal({ quoteId, onClose, initialData }: AddOptionModalProps) {
  const [loading, setLoading] = useState(false);
  
  const [items, setItems] = useState<QuoteItem[]>(
    initialData?.itemized_breakdown || [{ item: "Toilet Partitions", qty: 0 }]
  );
  
  const [formData, setFormData] = useState({
    material: initialData?.material || MATERIALS[0],
    manufacturer: initialData?.manufacturer || MANUFACTURERS[0],
    price: '', 
    color: initialData?.color || '',
    mounting_style: initialData?.mounting_style || 'Floor Mounted / Overhead Braced',
    shipping_included: initialData?.shipping_included || 'Includes Shipping',
    hardware_included: initialData?.hardware_included || 'All Hardware Needed for Installation is Included'
  });
  
  const supabase = createClient();
  const router = useRouter();

  const addItemRow = () => setItems([...items, { item: "", qty: 1 }]);
  const removeItemRow = (index: number) => 
    setItems(items.filter((item: QuoteItem, i: number) => i !== index));

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    // 1. Check if any quotes already exist for this submittal BEFORE inserting
const { count } = await supabase
  .from('individual_quotes')
  .select('*', { count: 'exact', head: true })
  .eq('quote_id', quoteId)
  .is('deleted_at', null);

console.log("Current Quote Count:", count); // DEBUG 1

if (count === 0) {

    // 2. Insert the new quote option
    const { error: insertError } = await supabase.from('individual_quotes').insert({
      quote_id: quoteId,
      ...formData,
      itemized_breakdown: items,
      quantity: items.reduce((sum: number, i: any) => sum + (Number(i.qty) || 0), 0)
    });

    if (insertError) throw insertError;

    // 3. If this was the FIRST quote, update the submittal's number and employee ID
    if (count === 0) {
      // Get the current logged-in user from Supabase Auth
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Auth User Email:", user?.email); // DEBUG 2
      
      if (user) {
        // IMPORTANT: Changed table name from 'profiles' to 'employees' to match your SQL
        const { data: employee, error: empError } = await supabase
          .from('employees') 
          .select('name_code, id')
          .eq('email', user.email) // Matching by email is often safer if IDs differ between auth/public
          .single();

        console.log("Found Employee:", employee); // DEBUG 3
        if (empError) console.error("Employee fetch error:", empError.message);

        if (employee?.name_code) {
          // Get the base quote number (e.g., 26-0170)
          const { data: submittal } = await supabase
            .from('quote_submittals')
            .select('quote_number')
            .eq('id', quoteId)
            .single();

          if (submittal && !submittal.quote_number.endsWith(employee.name_code)) {
            // Update BOTH the employee_quoted field and the quote_number suffix
            const { error: updateError } = await supabase
              .from('quote_submittals')
              .update({ 
                quote_number: `${submittal.quote_number}${employee.name_code}`,
                employee_quoted: employee.id // This fills the empty column you saw in SQL
              })
              .eq('id', quoteId);
              
            if (updateError) console.error("Submittal update error:", updateError.message);
          }
        }
      }
    }

    toast.success(initialData ? "Quote duplicated successfully!" : "Quote option added!");
    router.refresh();
    onClose();
  } catch (error: any) {
    console.error("Critical Error:", error.message);
    toast.error(error.message);
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
            {/* 1. Material & Manufacturer Selects */}
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

            {/* 2. Mounting Style & Color */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Mounting Style</label>
                <div className="relative">
                  <select className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition appearance-none font-bold text-zinc-900"
                    value={formData.mounting_style}
                    onChange={e => setFormData({...formData, mounting_style: e.target.value})}>
                    <option>Floor Mounted / Overhead Braced</option>
                    <option>Floor Mounted Only</option>
                    <option>Ceiling Hung</option>
                    <option>Floor to Ceiling Mounted</option>
                    <option>Accessories Only</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Color</label>
                <div className="relative">
                  <Palette className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input value={formData.color} placeholder="Color Name/Code" className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition font-bold"
                    onChange={e => setFormData({...formData, color: e.target.value})} />
                </div>
              </div>
            </div>

            {/* 3. Price & Shipping Select */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Price</label>
                <input required type="number" step="0.01" value={formData.price} placeholder="0.00" className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition font-bold text-blue-600"
                  onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Shipping Status</label>
                <div className="relative">
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <select className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition appearance-none font-bold text-zinc-900"
                    value={formData.shipping_included}
                    onChange={e => setFormData({...formData, shipping_included: e.target.value})}>
                    <option value="Shipping Only">Includes Shipping</option>
                    <option value="Shipping & Sales Tax">Includes Shipping & Sales Tax</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            {/* 4. Hardware Details */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Hardware Details</label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input value={formData.hardware_included} className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 transition font-bold"
                  onChange={e => setFormData({...formData, hardware_included: e.target.value})} />
              </div>
            </div>

            {/* 5. Searchable Item + Quantity List */}
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