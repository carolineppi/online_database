'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Plus, Trash2, Factory } from 'lucide-react';
import { toast } from 'sonner';

export default function ManageManufacturers() {
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newName, setNewName] = useState('');
  
  const supabase = createClient();

  const fetchManufacturers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('manufacturers')
      .select('*')
      .order('name', { ascending: true });
      
    if (error) {
      toast.error("Failed to load manufacturers");
    } else {
      setManufacturers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchManufacturers();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    setIsSubmitting(true);
    const { error } = await supabase
      .from('manufacturers')
      .insert([{ name: newName.trim() }]);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Manufacturer added!");
      setNewName('');
      fetchManufacturers();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    
    const { error } = await supabase
      .from('manufacturers')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${name} removed.`);
      fetchManufacturers();
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b bg-zinc-50/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <Factory size={20} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-zinc-900">Manufacturers</h2>
            <p className="text-xs text-zinc-500 uppercase font-black">Manage quote option manufacturers</p>
          </div>
        </div>
      </div>

      <div className="p-6 border-b border-zinc-100">
        <form onSubmit={handleAdd} className="flex gap-3">
          <input 
            type="text" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New manufacturer name..." 
            className="flex-1 p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium" 
          />
          <button 
            type="submit" 
            disabled={isSubmitting || !newName.trim()} 
            className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-600 transition shadow-md disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add
          </button>
        </form>
      </div>
      
      <div className="p-0">
        {loading ? (
          <div className="p-8 text-center flex justify-center">
             <Loader2 className="animate-spin text-zinc-400" size={24} />
          </div>
        ) : manufacturers.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 font-medium">No manufacturers found.</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {manufacturers.map(mfg => (
              <li key={mfg.id} className="flex items-center justify-between p-4 px-6 hover:bg-zinc-50 transition group">
                <p className="font-bold text-zinc-900">{mfg.name}</p>
                <button 
                  onClick={() => handleDelete(mfg.id, mfg.name)}
                  className="text-zinc-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-red-50"
                  title="Remove Manufacturer"
                >
                  <Trash2 size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}