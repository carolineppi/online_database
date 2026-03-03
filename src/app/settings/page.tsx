'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Settings, Link as LinkIcon, CheckCircle2, AlertCircle, Phone } from 'lucide-react';

export default function SettingsPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function checkStatus() {
      const { data } = await supabase
        .from('settings')
        .select('rc_refresh_token')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .single();
      
      setIsConnected(!!data?.rc_refresh_token);
      setLoading(false);
    }
    checkStatus();
  }, [supabase]);

  const handleLinkAccount = () => {
    // These match your RingCentral Portal settings
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
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight flex items-center gap-3">
          <Settings className="text-blue-600" size={32} />
          System Settings
        </h1>
        <p className="text-zinc-500">Manage your integrations and account preferences.</p>
      </div>

      <div className="grid gap-6">
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
                <p className="text-sm text-zinc-600 mb-6">
                  Authorize your RingCentral account to enable real-time call tracking and one-click submittal creation.
                </p>
                <button 
                  onClick={handleLinkAccount}
                  className="bg-zinc-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-black transition flex items-center gap-2 mx-auto"
                >
                  <LinkIcon size={18} />
                  Link RingCentral Account
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Next Step</p>
                  <p className="text-sm text-zinc-700 mb-4">
                    Your account is linked. Now, register the webhook to start receiving live call notifications.
                  </p>
                  <button 
                    onClick={handleSetupWebhook}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition text-sm"
                  >
                    Activate Call Webhook
                  </button>
                </div>
                
                <button 
                  onClick={handleLinkAccount}
                  className="text-zinc-400 text-xs font-bold hover:text-red-600 transition underline underline-offset-4"
                >
                  Reconnect or Change Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}