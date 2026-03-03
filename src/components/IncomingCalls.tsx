'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { PhoneIncoming, UserPlus, ShieldAlert, X } from 'lucide-react';
import CreateSubmittalForm from './CreateSubmittalForm';

export default function IncomingCalls() {
  const [calls, setCalls] = useState<any[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchCalls = async () => {
      const { data } = await supabase
        .from('ringcentral_calls')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      setCalls(data || []);
    };
    fetchCalls();

    const channel = supabase
      .channel('realtime_calls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ringcentral_calls' }, 
        (payload) => setCalls(prev => [payload.new, ...prev]))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const handleSpam = async (id: string) => {
    await supabase.from('ringcentral_calls').update({ status: 'spam' }).eq('id', id);
    setCalls(prev => prev.filter(c => c.id !== id));
  };

  const handleDismiss = async (id: string) => {
    await supabase.from('ringcentral_calls').update({ status: 'processed' }).eq('id', id);
    setCalls(prev => prev.filter(c => c.id !== id));
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 w-80 space-y-3 z-40">
        {calls.map((call) => (
          <div key={call.id} className="bg-white border-2 border-blue-500 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2 text-blue-600">
                <PhoneIncoming size={18} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Incoming Call</span>
              </div>
              <button onClick={() => handleDismiss(call.id)} className="text-zinc-300 hover:text-zinc-500 transition"><X size={16}/></button>
            </div>
            
            <div className="mb-4">
              <p className="text-lg font-black text-zinc-900">{call.phone_number}</p>
              <p className="text-xs text-zinc-500 font-medium">{call.caller_name || 'Unknown Caller'}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedPhone(call.phone_number)}
                className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-700 transition shadow-sm"
              >
                <UserPlus size={14} /> Create
              </button>
              <button 
                onClick={() => handleSpam(call.id)}
                className="px-3 py-2 border-2 border-zinc-100 text-zinc-400 rounded-xl hover:border-red-100 hover:text-red-500 transition"
                title="Mark as Spam"
              >
                <ShieldAlert size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedPhone && (
        <CreateSubmittalForm 
          initialPhone={selectedPhone} 
          onClose={() => setSelectedPhone(null)} 
        />
      )}
    </>
  );
}