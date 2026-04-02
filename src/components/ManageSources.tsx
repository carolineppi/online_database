'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ManageSources() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const fetchSources = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('campaign_sources').select('*').order('campaign_name');
    if (!error && data) setSources(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleAddSource = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    
    const formData = new FormData(e.currentTarget);
    const newSource = {
      campaign_name: formData.get('campaign_name') as string,
      campaign_id: formData.get('campaign_id') as string,
    };

    const { error } = await supabase.from('campaign_sources').insert([newSource]);
    
    if (error) {
      toast.error(error.message.includes('unique') ? 'This Campaign ID already exists.' : error.message);
    } else {
      toast.success('Campaign source added successfully!');
      (e.target as HTMLFormElement).reset();
      fetchSources();
    }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    
    const { error } = await supabase.from('campaign_sources').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete campaign source.');
    } else {
      toast.success(`${name} removed.`);
      setSources(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-8">
      {/* Add New Source Form */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <Megaphone size={20} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-zinc-900">Add Marketing Source</h2>
            <p className="text-xs text-zinc-500 uppercase font-black">Map Google Ad IDs to Human-Readable Names</p>
          </div>
        </div>

        <form onSubmit={handleAddSource} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Campaign Name</label>
              <input name="campaign_name" required placeholder="e.g. Performance Max" className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-amber-500 rounded-xl outline-none font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Campaign ID Number</label>
              <input name="campaign_id" required placeholder="e.g. 20931909318" className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-amber-500 rounded-xl outline-none font-medium text-zinc-600" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 bg-zinc-900 text-white py-3 px-6 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-amber-600 transition shadow-lg disabled:opacity-50">
            <Plus size={16} /> {saving ? 'Saving...' : 'Add Source Map'}
          </button>
        </form>
      </div>

      {/* Sources List Table */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-400 text-xs uppercase font-bold tracking-wider border-b border-zinc-100">
            <tr>
              <th className="px-6 py-4">Campaign Name</th>
              <th className="px-6 py-4">Google Ads ID</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr><td colSpan={3} className="p-8 text-center text-zinc-400">Loading sources...</td></tr>
            ) : sources.map((source) => (
              <tr key={source.id} className="hover:bg-zinc-50 transition">
                <td className="px-6 py-4 font-bold text-zinc-900">{source.campaign_name}</td>
                <td className="px-6 py-4 text-zinc-500 font-mono">{source.campaign_id}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(source.id, source.campaign_name)}
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