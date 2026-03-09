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

      <div className="grid gap-8">
        {/* RingCentral Integration Card */}
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-zinc-50/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                <Phone size={20} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900">RingCentral Integration</h3>
                <p className="text-xs text-zinc-500">Sync live calls with your submittal dashboard.</p>
              </div>
            </div>
            
            {isConnected ? (
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                <CheckCircle2 size={12} /> Connected
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                <AlertCircle size={12} /> Disconnected
              </div>
            )}
          </div>

          <div className="p-8">
            {!isConnected ? (
              <div className="text-center py-4">
                <p className="text-sm text-zinc-600 mb-6 font-medium">
                  Authorize your RingCentral account to enable real-time call tracking and one-click submittal creation.
                </p>
                <button 
                  onClick={handleLinkAccount}
                  className="bg-zinc-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-black transition flex items-center gap-2 mx-auto shadow-lg shadow-zinc-200"
                >
                  <LinkIcon size={18} />
                  Link RingCentral Account
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-5 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Next Step</p>
                  <p className="text-sm text-zinc-700 mb-4 font-medium">
                    Your account is successfully linked. Now, register the webhook to start receiving live call notifications in your dashboard.
                  </p>
                  <button 
                    onClick={handleSetupWebhook}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition text-sm shadow-md shadow-blue-100"
                  >
                    Activate Call Webhook
                  </button>
                </div>
                
                <button 
                  onClick={handleLinkAccount}
                  className="text-zinc-400 text-xs font-bold hover:text-red-600 transition underline underline-offset-4 decoration-zinc-200"
                >
                  Reconnect or Change Account
                </button>
              </div>
            )}
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
    </div>
  );
}