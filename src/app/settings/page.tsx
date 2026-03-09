'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  Settings, 
  Link as LinkIcon, 
  CheckCircle2, 
  AlertCircle, 
  Phone,
  ShieldCheck, // For audit section
  History      // For audit section
} from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null); // State for all settings
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase
        .from('settings')
        .select('*') // Fetch all columns for the audit log
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .single();
      
      setSettings(data);
      setIsConnected(!!data?.rc_refresh_token);
      setLoading(false);
    }
    fetchSettings();
  }, [supabase]);

  const handleLinkAccount = () => {
    const clientId = process.env.NEXT_PUBLIC_RC_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_RC_REDIRECT_URI || '');
    const baseUrl = 'https://platform.ringcentral.com/restapi/oauth/authorize';
    const authUrl = `${baseUrl}?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
    window.location.href = authUrl;
  };

  const handleSetupWebhook = async () => {
    const res = await fetch('/api/admin/setup-webhook');
    const data = await res.json();
    if (data.message) alert("Webhook Registered Successfully!");
    else alert("Error: " + data.error);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen bg-zinc-50/50">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight flex items-center gap-3">
          <Settings className="text-blue-600" size={32} />
          System Settings
        </h1>
        <p className="text-zinc-500">Manage your integrations and account preferences.</p>
      </div>

      // Add this to your main container div
      <div className="p-8 max-w-4xl mx-auto min-h-screen bg-slate-900 bg-[url('/grid.svg')] text-slate-300">
        
        {/* Update the RingCentral Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg shadow-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-md flex items-center justify-center">
                <Phone size={20} />
              </div>
              <div>
                <h3 className="font-mono font-bold text-white uppercase tracking-tighter">Integration_RC_01</h3>
                <p className="text-[10px] text-slate-500 font-mono italic">TELEPHONY_SYNC_ENABLED</p>
              </div>
            </div>
            
            {/* Stamped Status Badges */}
            {isConnected ? (
              <div className="border-2 border-cyan-500/50 text-cyan-400 px-3 py-1 rounded-sm text-[10px] font-black uppercase rotate-[-2deg] shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                ACTIVE_LINK
              </div>
            ) : (
              <div className="border-2 border-amber-500/50 text-amber-500 px-3 py-1 rounded-sm text-[10px] font-black uppercase rotate-[1deg]">
                LINK_REQUIRED
              </div>
            )}
          </div>

          {/* Update Action Buttons */}
          <button 
            onClick={handleSetupWebhook}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 font-mono font-bold uppercase tracking-widest transition-all shadow-[0_4px_0_rgb(8,145,178)] active:translate-y-[2px] active:shadow-none"
          >
            [ EXECUTE_WEBHOOK_ACTIVATION ]
          </button>
        </div>
      </div>

        {/* 1. SYSTEM AUDIT LOG SECTION */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
            <div className="h-8 w-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500">
              <ShieldCheck size={18} />
            </div>
            <h2 className="font-bold text-zinc-900 uppercase text-xs tracking-widest">System Audit Log</h2>
          </div>
          
          <div className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Last Manual Purge</p>
                {settings?.last_purge_at ? (
                  <div className="space-y-2">
                    <p className="text-lg font-black text-zinc-900">
                      {new Date(settings.last_purge_at).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded font-bold uppercase">
                        Admin: {settings.last_purge_by}
                      </span>
                      <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold uppercase border border-red-100">
                        Table: {settings.last_purge_table}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 font-medium italic">No purge history recorded.</p>
                )}
              </div>
              
              <div className="h-14 w-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-200 border border-zinc-100">
                <History size={28} />
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-50/50 p-4 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-2 italic">
              <AlertCircle size={10} /> 
              Permanent deletions are logged for security and compliance purposes.
            </p>
          </div>
        </div>
      </div>
  );
}