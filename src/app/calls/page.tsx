'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  PhoneIncoming, 
  UserPlus, 
  ShieldAlert, 
  Clock, 
  Trash2, 
  Search,
  Phone
} from 'lucide-react';
import CreateSubmittalForm from '@/components/CreateSubmittalForm';
import { toast } from 'sonner';

export default function CallLogPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  const fetchCalls = async () => {
    const { data, error } = await supabase
      .from('ringcentral_calls')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) setCalls(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCalls();

    // Listen for new calls in real-time
    const channel = supabase
      .channel('call_log_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'ringcentral_calls' }, 
        () => fetchCalls()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('ringcentral_calls')
      .update({ status })
      .eq('id', id);

    if (error) toast.error("Update failed");
    else toast.success(`Call marked as ${status}`);
  };

  const filteredCalls = calls.filter(call => 
    call.phone_number?.includes(searchQuery) || 
    call.caller_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto bg-zinc-50 min-h-screen">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">Call Queue</h1>
          <p className="text-zinc-500 text-sm">Real-time inbound tracking from RingCentral.</p>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search numbers..." 
            className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Caller Information</th>
              <th className="px-6 py-4">Received At</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {filteredCalls.map((call) => (
              <tr key={call.id} className={`group hover:bg-zinc-50/50 transition ${call.status === 'spam' ? 'opacity-50 grayscale' : ''}`}>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tighter ${
                    call.status === 'active' ? 'bg-blue-100 text-blue-600' : 
                    call.status === 'spam' ? 'bg-red-100 text-red-600' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {call.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="font-black text-zinc-900 text-lg flex items-center gap-2">
                    <Phone size={14} className="text-blue-500" /> {call.phone_number}
                  </p>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-tight">{call.caller_name || 'Unknown Caller'}</p>
                </td>
                <td className="px-6 py-4 text-zinc-400 text-xs font-medium">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(call.created_at).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button 
                      onClick={() => setSelectedPhone(call.phone_number)}
                      className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition flex items-center gap-2"
                    >
                      <UserPlus size={14} /> Create Submittal
                    </button>
                    <button 
                      onClick={() => updateStatus(call.id, 'spam')}
                      className="p-2 border rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Mark as Spam"
                    >
                      <ShieldAlert size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredCalls.length === 0 && !loading && (
          <div className="p-20 text-center text-zinc-400">
            <PhoneIncoming size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">No calls found in the log</p>
          </div>
        )}
      </div>

      {/* Submittal Modal */}
      {selectedPhone && (
        <CreateSubmittalForm 
          initialPhone={selectedPhone} 
          onClose={() => setSelectedPhone(null)} 
        />
      )}
    </div>
  );
}