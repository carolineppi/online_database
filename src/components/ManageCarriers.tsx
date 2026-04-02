'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Truck, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ManageCarriers() {
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const fetchCarriers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('carriers').select('*').order('name');
    if (!error && data) setCarriers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCarriers();
  }, []);

  const handleAddCarrier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    
    const formData = new FormData(e.currentTarget);
    const newCarrier = {
      name: formData.get('name') as string,
      site: formData.get('site') as string,
      phone: formData.get('phone') as string,
    };

    const { error } = await supabase.from('carriers').insert([newCarrier]);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Carrier added successfully!');
      (e.target as HTMLFormElement).reset();
      fetchCarriers();
    }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    
    const { error } = await supabase.from('carriers').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete carrier.');
    } else {
      toast.success(`${name} removed.`);
      setCarriers(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-8">
      {/* Add New Carrier Form */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <Truck size={20} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-zinc-900">Add Freight Carrier</h2>
            <p className="text-xs text-zinc-500 uppercase font-black">Register a new LTL or Parcel Carrier</p>
          </div>
        </div>

        <form onSubmit={handleAddCarrier} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Carrier Name</label>
              <input name="name" required placeholder="e.g. FedEx Freight" className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 rounded-xl outline-none font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Tracking URL</label>
              <input name="site" required placeholder="https://..." className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 rounded-xl outline-none font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Phone Number</label>
              <input name="phone" placeholder="e.g. 800-555-1234" className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 rounded-xl outline-none font-medium" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 bg-zinc-900 text-white py-3 px-6 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 transition shadow-lg disabled:opacity-50">
            <Plus size={16} /> {saving ? 'Saving...' : 'Add Carrier'}
          </button>
        </form>
      </div>

      {/* Carrier List Table */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-400 text-xs uppercase font-bold tracking-wider border-b border-zinc-100">
            <tr>
              <th className="px-6 py-4">Carrier Name</th>
              <th className="px-6 py-4">Tracking Website</th>
              <th className="px-6 py-4">Phone Number</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-zinc-400">Loading carriers...</td></tr>
            ) : carriers.map((carrier) => (
              <tr key={carrier.id} className="hover:bg-zinc-50 transition">
                <td className="px-6 py-4 font-bold text-zinc-900">{carrier.name}</td>
                <td className="px-6 py-4 text-blue-600 truncate max-w-[200px]">{carrier.site}</td>
                <td className="px-6 py-4 text-zinc-500 font-mono">{carrier.phone || 'N/A'}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(carrier.id, carrier.name)}
                    className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}