'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Palette, Trash2, Plus, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

const MATERIALS = [
  "Powder Coated Steel (PCS)", 
  "Series 1552 High Pressure Laminate (HPL)", 
  "HineyHiders Solid Plastic", 
  "HDPE - Solid Plastic", 
  "Series 1082 Solid Phenolic", 
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

  // Refs for Drag and Drop
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    fetchColors(selectedMaterial);
  }, [selectedMaterial]);

  const fetchColors = async (material: string) => {
    setFetching(true);
    const { data, error } = await supabase
      .from('material_colors')
      .select('*')
      .eq('material', material)
      .order('order_index', { ascending: true }); // Pull in our saved order
      
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
    const nextIndex = colors.length; // Put it at the bottom of the list
    const { error } = await supabase
      .from('material_colors')
      .insert([{ material: selectedMaterial, color: newColor.trim(), order_index: nextIndex }]);

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

  // --- DRAG AND DROP LOGIC ---
  const handleSort = async () => {
    if (dragItem.current === null || dragOverItem.current === null) return;

    // 1. Duplicate the current array
    let _colors = [...colors];
    
    // 2. Remove and save the dragged item
    const draggedItemContent = _colors.splice(dragItem.current, 1)[0];
    
    // 3. Insert the dragged item at the new hovered position
    _colors.splice(dragOverItem.current, 0, draggedItemContent);
    
    // 4. Reset the refs
    dragItem.current = null;
    dragOverItem.current = null;
    
    // 5. Update UI instantly
    setColors(_colors);

    // 6. Map the new array to update the order_index in Supabase
    const updates = _colors.map((c, index) => ({
      id: c.id,
      material: c.material,
      color: c.color,
      order_index: index,
    }));

    const { error } = await supabase.from('material_colors').upsert(updates);
    if (error) {
      toast.error("Failed to save the new order.");
      fetchColors(selectedMaterial); // Revert to database state on failure
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

        {/* Colors List - Now in a single column for drag/drop */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-4 tracking-widest border-b pb-2">
            Current Colors for {selectedMaterial} (Drag to Reorder)
          </label>
          
          {fetching ? (
            <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase text-xs">
              <Loader2 className="animate-spin" size={16} /> Loading colors...
            </div>
          ) : colors.length === 0 ? (
            <p className="text-zinc-500 font-medium text-sm italic">No colors added for this material yet.</p>
          ) : (
            <div className="flex flex-col gap-2 max-w-xl">
              {colors.map((c, index) => (
                <div 
                  key={c.id} 
                  draggable
                  onDragStart={(e) => (dragItem.current = index)}
                  onDragEnter={(e) => (dragOverItem.current = index)}
                  onDragEnd={handleSort}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-zinc-200 group hover:border-pink-300 hover:shadow-md transition cursor-move"
                >
                  <div className="flex items-center gap-4">
                    <GripVertical size={18} className="text-zinc-300 group-hover:text-pink-400 transition" />
                    <span className="font-bold text-sm text-zinc-700">{c.color}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteColor(c.id)}
                    className="text-zinc-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-2"
                  >
                    <Trash2 size={18} />
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