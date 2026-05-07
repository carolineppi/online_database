'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Star, Clock, ShieldAlert, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ManageReviews() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [settings, setSettings] = useState({ delay_days: 7, cooldown_days: 30 });
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setFetching(true);
    // Fetch Settings
    const { data: settingsData } = await supabase.from('review_settings').select('*').eq('id', 1).single();
    if (settingsData) setSettings({ delay_days: settingsData.delay_days, cooldown_days: settingsData.cooldown_days });

    // Fetch Recent Reviews (sent or skipped)
    const { data: reviewsData } = await supabase
      .from('review_emails')
      .select('*, jobs(quote_submittals(job_name, quote_number))')
      .neq('status', 'pending')
      .order('scheduled_for', { ascending: false })
      .limit(10);
      
    if (reviewsData) setRecentReviews(reviewsData);
    setFetching(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase
      .from('review_settings')
      .update({ delay_days: settings.delay_days, cooldown_days: settings.cooldown_days })
      .eq('id', 1);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Review settings updated!");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <Star size={20} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-zinc-900">Google Review Automation</h2>
            <p className="text-xs text-zinc-500 uppercase font-black">Configure automated review request emails</p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">
                <Clock size={14} /> Send Delay (Days)
              </label>
              <input 
                type="number" 
                min="0"
                value={settings.delay_days}
                onChange={(e) => setSettings({...settings, delay_days: parseInt(e.target.value) || 0})}
                className="w-full p-4 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-amber-500 rounded-xl outline-none transition font-bold" 
              />
              <p className="text-[10px] text-zinc-400 mt-2 font-bold uppercase tracking-widest">Days after tracking email to send review request (at Midday).</p>
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">
                <ShieldAlert size={14} /> Spam Protection (Days)
              </label>
              <input 
                type="number" 
                min="0"
                value={settings.cooldown_days}
                onChange={(e) => setSettings({...settings, cooldown_days: parseInt(e.target.value) || 0})}
                className="w-full p-4 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-amber-500 rounded-xl outline-none transition font-bold" 
              />
              <p className="text-[10px] text-zinc-400 mt-2 font-bold uppercase tracking-widest">Do not send another review email to the same address within this period.</p>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-amber-500 transition shadow-lg shadow-zinc-200 disabled:opacity-50"
          >
            <Save size={16} /> {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-zinc-50/50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-zinc-900">Recent Review Emails</h2>
            <p className="text-xs text-zinc-500 uppercase font-black">History of automated requests</p>
          </div>
          {fetching && <Loader2 className="animate-spin text-zinc-400" size={20} />}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Status / Date</th>
                <th className="px-6 py-4">Customer Email</th>
                <th className="px-6 py-4">Job Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recentReviews.map((rev) => (
                <tr key={rev.id} className="hover:bg-zinc-50 transition">
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                      rev.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600'
                    }`}>
                      {rev.status === 'skipped_spam' ? 'Skipped (Spam)' : rev.status}
                    </span>
                    <div className="text-xs text-zinc-500 mt-1 font-medium">
                      {new Date(rev.sent_at || rev.scheduled_for).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-zinc-800">{rev.customer_email}</td>
                  <td className="px-6 py-4 text-zinc-500 font-medium">
                    {rev.jobs?.quote_submittals?.job_name || 'N/A'} 
                    <span className="text-[10px] font-mono ml-2">#{rev.jobs?.quote_submittals?.quote_number}</span>
                  </td>
                </tr>
              ))}
              {recentReviews.length === 0 && !fetching && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    No review emails sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}