'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Palette, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const MATERIALS = [
  "Powder Coated Steel (PCS)", 
  "High Pressure Laminate (HPL)", 
  "HDPE Solid Plastic", 
  "Solid Phenolic", 
  "Stainless Steel", 
  "Bathroom Accessories per Attached Submittal"
];

export default function ManageColors() {
  const [selectedMaterial, setSelectedMaterial] = useState(MATERIALS[0]);
  const [colors, setColors] = useState<any[]>([]);
  const [newColor, setNewColor] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const supabase = createClient();

  useEffect(() => {
    fetchColors(selectedMaterial);
  }, [selectedMaterial]);

  const fetchColors = async (material: string) => {
    setFetching(true);
    const { data, error } = await supabase
      .from('material_colors')
      .select('*')
      .eq('material', material)
      .order('color');
      
    if (error) {
      toast.error("Failed to load colors");
    } else {
      setColors(data || []);
    }
    setFetching(false);
  };

  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColor.trim()) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('material_colors')
      .insert([{ material: selectedMaterial, color: newColor.trim() }]);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Color added!");
      setNewColor('');
      fetchColors(selectedMaterial);
    }
    setLoading(false);
  };

  const handleDeleteColor = async (id: string) => {
    if (!confirm("Remove this color option?")) return;
    
    const { error } = await supabase
      .from('material_colors')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Color removed!");
      fetchColors(selectedMaterial);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
        <div className="h-10 w-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center">
          <Palette size={20} />
        </div>
        <div>
          <h2 className="font-bold text-lg text-zinc-900">Manage Material Colors</h2>
          <p className="text-xs text-zinc-500 uppercase font-black">Configure dropdown options for each material</p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Material Selector */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Select Material</label>
          <select 
            value={selectedMaterial}
            onChange={(e) => setSelectedMaterial(e.target.value)}
            className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-pink-500 transition appearance-none font-bold text-zinc-900"
          >
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Add Color Form */}
        <form onSubmit={handleAddColor} className="flex gap-4 items-end">
          <div className="flex-grow">
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Add New Color</label>
            <input 
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              placeholder="e.g. Navy Blue" 
              className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-pink-500 transition font-bold"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !newColor.trim()}
            className="h-[56px] px-8 flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-pink-600 transition shadow-lg shadow-zinc-200 disabled:opacity-50 whitespace-nowrap"
          >
            <Plus size={16} /> Add
          </button>
        </form>

        {/* Colors List */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-4 tracking-widest border-b pb-2">
            Current Colors for {selectedMaterial}
          </label>
          
          {fetching ? (
            <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase text-xs">
              <Loader2 className="animate-spin" size={16} /> Loading colors...
            </div>
          ) : colors.length === 0 ? (
            <p className="text-zinc-500 font-medium text-sm italic">No colors added for this material yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {colors.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-100 group hover:border-pink-200 transition">
                  <span className="font-bold text-sm text-zinc-700">{c.color}</span>
                  <button 
                    onClick={() => handleDeleteColor(c.id)}
                    className="text-zinc-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}