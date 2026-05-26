'use client'; // Make it a client component

import Image from "next/image";
import { createClient } from '@/utils/supabase/client'; // Use the client version
import RecentActivity from '@/components/RecentActivity';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Plus, ClipboardList, UserCheck, Trash2, User, Loader2 } from 'lucide-react';
import SubmittalSearchBar from '@/components/SubmittalSearchBar';
import NewSubmittalButton from '@/components/NewSubmittalButton'; 
import { useEffect, useState } from 'react';
import { isStrictlyAccounting, normalizeRoles } from '@/utils/rbac';

export default function Page() {
  const CURRENT_EMPLOYEE_ID = '1';
  const supabase = createClient();
  const router = useRouter();

  // State
  const [authorized, setAuthorized] = useState(false);
  const [unquotedSubmittals, setUnquotedSubmittals] = useState<any[]>([]);
  const [campaignSources, setCampaignSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. RBAC Bouncer Effect
  useEffect(() => {
    const saved = localStorage.getItem('employee');
    
    if (!saved) {
      window.location.href = '/login'; 
      return;
    }

    const employee = JSON.parse(saved);
    const roles = normalizeRoles(employee.roles);

    if (isStrictlyAccounting(roles)) {
      router.replace('/accounting'); // Kick strictly accounting users
    } else {
      setAuthorized(true); // Let everyone else see the dashboard
    }
  }, [router]);

  // 2. Data Fetching Effect (Only runs if authorized)
  useEffect(() => {
    if (!authorized) return;

    const fetchData = async () => {
      setLoading(true);
      
      // Fetch Campaigns
      const { data: campaigns } = await supabase.from('campaign_sources').select('*');
      setCampaignSources(campaigns || []);

      // Fetch Submittals
      const { data: submittals, error: fetchError } = await supabase
        .from('quote_submittals')
        .select('*')
        .or('status.ilike.pending,and(job_name.ilike.WooCommerce%,status.ilike.quoted)')
        .is('deleted_at', null) 
        .order('created_at', { ascending: false });

      if (fetchError) console.error("Database Error:", fetchError.message);
      setUnquotedSubmittals(submittals || []);
      
      setLoading(false);
    };

    fetchData();
  }, [authorized, supabase]);

  // Soft Delete Handler (Client Side)
  const handleSoftDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Move this submittal to the trash?")) return;
    
    const { error } = await supabase
      .from('quote_submittals')
      .update({ deleted_at: new Date().toISOString() }) 
      .eq('id', id);

    if (!error) {
       // Refresh the list locally
       setUnquotedSubmittals(unquotedSubmittals.filter(item => item.id !== id));
    } else {
      console.error("Delete error:", error);
    }
  };

  // Don't flash the dashboard to the accountant before the redirect fires
  if (!authorized) return (
     <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
     </div>
  );

  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">Pipeline Dashboard</h1>
            <p className="text-zinc-500">Manage incoming submittals and your active quotes.</p>
          </div>
          <NewSubmittalButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b bg-zinc-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-zinc-900">Pending Quotes</h2>
                    <p className="text-xs text-zinc-500 uppercase font-black">Requires Attention</p>
                  </div>
                </div>
                <span className="bg-zinc-100 text-zinc-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                  {unquotedSubmittals.length || 0} Total
                </span>
              </div>

              <div className="divide-y divide-zinc-100">
                {loading ? (
                    <div className="p-16 text-center flex justify-center">
                        <Loader2 className="animate-spin text-zinc-400" size={24} />
                    </div>
                ) : unquotedSubmittals.length ? unquotedSubmittals.map((item) => {
                  
                  // Database-driven Marketing Source Logic
                  const matchedCampaign = campaignSources?.find(c => c.campaign_id === item.quote_source);
                  const isManual = item.quote_source === 'PM Input';
                  
                  const isPaid = !!matchedCampaign || (!isManual && item.quote_source !== 'Organic / Direct' && item.quote_source !== 'Unknown' && !isNaN(Number(item.quote_source)));
                  const badgeText = matchedCampaign ? matchedCampaign.campaign_name : 'Paid Ad';

                  // Logic to spot WooCommerce orders that are currently waiting for a winner
                  const isWooCommerce = item.job_name?.toLowerCase().includes('woocommerce');
                  const isQuoted = item.status?.toUpperCase() === 'QUOTED';

                  return (
                    <div key={item.id} className="group flex items-center hover:bg-zinc-50 transition">
                      <Link href={`/submittals/${item.id}`} className="flex-grow block p-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
                              #{item.quote_number}
                            </span>
                            
                            {/* WOOCOMMERCE WAITING FOR WINNER BADGE */}
                            {isWooCommerce && isQuoted && (
                              <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" />
                                Quoted (Cart)
                              </span>
                            )}

                            {/* DYNAMIC PAID AD BADGE */}
                            {isPaid && (
                              <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
                                {badgeText}
                              </span>
                            )}

                            {/* MANUAL ENTRY BADGE */}
                            {isManual && (
                              <span className="flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                                <User size={10} /> PM Input
                              </span>
                            )}

                            <span className="text-xs text-zinc-400 font-medium">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="font-bold text-zinc-900 group-hover:text-blue-600 transition">
                            {item.job_name}
                          </h3>
                        </div>
                      </Link>

                      {/* Action Buttons: Delete & View */}
                      <div className="flex items-center gap-3 pr-6">
                        <button 
                          onClick={(e) => handleSoftDelete(item.id, e)}
                          className="h-9 w-9 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition shadow-sm bg-white"
                          title="Move to Trash"
                        >
                          <Trash2 size={16} />
                        </button>
                        <Link 
                          href={`/submittals/${item.id}`}
                          className="h-9 w-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white hover:bg-blue-600 transition shadow-lg shadow-zinc-200"
                        >
                          <Plus size={18} />
                        </Link>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="p-16 text-center">
                    <p className="text-zinc-400 font-medium">All submittals have been quoted!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2"><Search size={18} /> Quick Search</h3>
              <SubmittalSearchBar />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}