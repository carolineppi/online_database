'use client'; // Make it a client component

import Image from "next/image";
import { createClient } from '@/utils/supabase/client'; // Use the client version
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Plus, ClipboardList, UserCheck, Trash2, User, Loader2, Tag, X } from 'lucide-react';
import SubmittalSearchBar from '@/components/SubmittalSearchBar';
import NewSubmittalButton from '@/components/NewSubmittalButton'; 
import { useEffect, useState } from 'react';
import { isStrictlyAccounting, normalizeRoles } from '@/utils/rbac';
import { toast } from "sonner"; // Assuming you use sonner for toasts based on previous files!

export default function Page() {
  const CURRENT_EMPLOYEE_ID = '1';
  const supabase = createClient();
  const router = useRouter();

  // State
  const [authorized, setAuthorized] = useState(false);
  const [unquotedSubmittals, setUnquotedSubmittals] = useState<any[]>([]);
  const [campaignSources, setCampaignSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Quick Status Modal State
  const [statusModalId, setStatusModalId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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
      
      const { data: campaigns } = await supabase.from('campaign_sources').select('*');
      setCampaignSources(campaigns || []);

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
       setUnquotedSubmittals(unquotedSubmittals.filter(item => item.id !== id));
    } else {
      console.error("Delete error:", error);
    }
  };

  // Quick Status Change Handler
  const handleQuickStatus = async (status: string) => {
    if (!statusModalId) return;
    setIsUpdatingStatus(true);
    
    const { error } = await supabase
      .from('quote_submittals')
      .update({ status })
      .eq('id', statusModalId);

    if (!error) {
      // Remove it from the pending list since it has been categorized
      setUnquotedSubmittals(unquotedSubmittals.filter(item => item.id !== statusModalId));
      toast?.success(`Marked as ${status}`);
    } else {
      console.error("Status Update Error:", error);
      toast?.error("Failed to update status");
    }
    
    setIsUpdatingStatus(false);
    setStatusModalId(null);
  };

  if (!authorized) return (
     <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
     </div>
  );

  return (
    <main className="pl-64 min-h-screen bg-gray-50 relative"> 
      <div className="p-8 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">New Quotes</h1>
            <p className="text-zinc-500">Manage incoming submittals and woocommerce orders</p>
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
                    <h2 className="font-bold text-lg text-zinc-900">New Quotes</h2>
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
                  
                  const matchedCampaign = campaignSources?.find(c => c.campaign_id === item.quote_source);
                  const isManual = item.quote_source === 'PM Input';
                  const isPaid = !!matchedCampaign || (!isManual && item.quote_source !== 'Organic / Direct' && item.quote_source !== 'Unknown' && !isNaN(Number(item.quote_source)));
                  const badgeText = matchedCampaign ? matchedCampaign.campaign_name : 'Paid Ad';
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
                            
                            {isWooCommerce && isQuoted && (
                              <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" />
                                Quoted (Cart)
                              </span>
                            )}

                            {isPaid && (
                              <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
                                {badgeText}
                              </span>
                            )}

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

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pr-6">
                        {/* NEW TAG BUTTON */}
                        <button 
                          onClick={(e) => { e.preventDefault(); setStatusModalId(item.id); }}
                          className="h-9 w-9 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition shadow-sm bg-white"
                          title="Categorize Job"
                        >
                          <Tag size={16} />
                        </button>
                        
                        <button 
                          onClick={(e) => handleSoftDelete(item.id, e)}
                          className="h-9 w-9 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition shadow-sm bg-white"
                          title="Move to Trash"
                        >
                          <Trash2 size={16} />
                        </button>
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

      {/* QUICK STATUS MODAL */}
      {statusModalId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-zinc-900 uppercase tracking-tight">Categorize Job</h3>
              <button onClick={() => setStatusModalId(null)} className="text-zinc-400 hover:text-zinc-800"><X size={20}/></button>
            </div>
            
            <div className="space-y-3">
              <button onClick={() => handleQuickStatus('SPAM')} disabled={isUpdatingStatus} className="w-full p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition flex items-center justify-between group">
                Mark as Spam
                <Tag size={16} className="text-zinc-400 group-hover:text-red-500" />
              </button>
              <button onClick={() => handleQuickStatus('DUPLICATE')} disabled={isUpdatingStatus} className="w-full p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 transition flex items-center justify-between group">
                Mark as Duplicate
                <Tag size={16} className="text-zinc-400 group-hover:text-amber-500" />
              </button>
              <button onClick={() => handleQuickStatus('OFFICE')} disabled={isUpdatingStatus} className="w-full p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition flex items-center justify-between group">
                Send to Office
                <Tag size={16} className="text-zinc-400 group-hover:text-blue-500" />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}