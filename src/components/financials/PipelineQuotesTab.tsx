'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  FileText, DollarSign, TrendingUp, Ban, Copy, Building, Download, Loader2 
} from 'lucide-react';

export default function PipelineQuotesTab({ filters }: { filters: any }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const [calcModes, setCalcModes] = useState<Record<string, 'avg' | 'sum'>>({});
  
  const [data, setData] = useState({
    quotesList: [] as any[],
    totalQuotes: 0,
    spamCount: 0,
    duplicateCount: 0,
    officeCount: 0
  });

  useEffect(() => {
    const fetchQuotes = async () => {
      setLoading(true);
      try {
        const [quotesRes, campaignRes] = await Promise.all([
          supabase.from('quote_submittals')
            .select('*')
            .gte('created_at', filters.exactStart)
            .lte('created_at', filters.exactEnd)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase.from('campaign_sources').select('*')
        ]);

        const rawQuotes = quotesRes.data || [];
        const campaignMap = new Map(campaignRes.data?.map(c => [c.campaign_id, c.campaign_name]) || []);

        const quoteIds = rawQuotes.map(q => q.id);
        let optsData: any[] = [];
        let addonsData: any[] = [];
        let jobsData: any[] = [];

        // Fetch related data manually using the Quote IDs
        if (quoteIds.length > 0) {
          const [oRes, aRes, jRes] = await Promise.all([
            supabase.from('individual_quotes').select('id, quote_id, price').in('quote_id', quoteIds).is('deleted_at', null),
            supabase.from('add_ons').select('price, quote_id').in('quote_id', quoteIds).is('deleted_at', null),
            supabase.from('jobs').select('id, quote_id, winning_quote_ids, accepted_individual_quote').in('quote_id', quoteIds).is('deleted_at', null)
          ]);
          optsData = oRes.data || [];
          addonsData = aRes.data || [];
          jobsData = jRes.data || [];
        }

        const filteredQuotes = rawQuotes.map(q => {
          // Attach relations manually
          q.options = optsData.filter(o => o.quote_id === q.id);
          q.addons = addonsData.filter(a => a.quote_id === q.id);
          q.jobs = jobsData.filter(j => j.quote_id === q.id);

          // Standardized Origin Logic
          const isWoo = q.source === 'WooCommerce';
          const isManual = q.quote_source === 'PM Input';
          const isOrganic = q.quote_source === 'Organic / Direct';
          const isPaid = /^\d+$/.test(q.quote_source || ''); 
          
          const displayCampaign = isPaid ? (campaignMap.get(q.quote_source) || q.quote_source) : '';

          q.is_woo = isWoo;
          q.is_manual = isManual;
          q.is_organic = isOrganic;
          q.is_paid = isPaid;
          q.display_campaign_name = displayCampaign;

          return q;
        }).filter(q => {
          // Apply Global Filters
          if (filters.originFilter === 'woo' && !q.is_woo) return false;
          if (filters.originFilter === 'manual' && !q.is_manual) return false;
          if (filters.originFilter === 'organic' && !q.is_organic) return false;
          if (filters.campaignFilter !== 'all' && q.display_campaign_name !== filters.campaignFilter) return false;
          return true;
        });

        setData({
          quotesList: filteredQuotes,
          totalQuotes: filteredQuotes.length,
          spamCount: filteredQuotes.filter(q => q.status?.toUpperCase() === 'SPAM').length,
          duplicateCount: filteredQuotes.filter(q => q.status?.toUpperCase() === 'DUPLICATE').length,
          officeCount: filteredQuotes.filter(q => q.status?.toUpperCase() === 'OFFICE').length,
        });
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchQuotes();
  }, [filters, supabase]);

  // --- DYNAMIC CALCULATIONS ---
  const toggleCalcMode = (id: string, mode: 'avg' | 'sum') => {
    setCalcModes(prev => ({ ...prev, [id]: mode }));
  };

  const quotesViewData = data.quotesList.map(q => {
    const mode = calcModes[q.id] || 'avg';
    const isConverted = q.status === 'WON' || (q.jobs && q.jobs.length > 0);
    const optionsCount = q.options.length;
    const addonsTotal = q.addons.reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);
    
    let baseValue = 0;
    
    if (isConverted && q.jobs?.[0]) {
      const linkedJob = q.jobs[0];
      const winningIds = linkedJob.winning_quote_ids || (linkedJob.accepted_individual_quote ? [linkedJob.accepted_individual_quote] : []);
      const winningOptions = q.options.filter((o: any) => winningIds.includes(o.id));
      baseValue = winningOptions.reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0);
    } else {
      const optionsSum = q.options.reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0);
      if (optionsCount > 0) {
        baseValue = mode === 'avg' ? optionsSum / optionsCount : optionsSum;
      }
    }
    
    const potentialValue = baseValue + addonsTotal;

    return { ...q, mode, potentialValue, optionsCount, isConverted };
  });

  const totalPotentialRevenue = quotesViewData.reduce((sum, q: any) => sum + q.potentialValue, 0); 
  const avgQuoteValue = quotesViewData.length > 0 ? totalPotentialRevenue / quotesViewData.length : 0;

  // --- EXPORT ---
  const handleExportQuotesCSV = () => {
    if (quotesViewData.length === 0) return;
    const headers = ['Project Name', 'Quote #', 'Status', 'Marketing Category', 'Specific Campaign', 'Options Count', 'Calculation Mode', 'Potential Revenue'];
    const rows = quotesViewData.map(q => {
      const sourceCat = q.is_paid ? 'Paid Ad' : q.is_manual ? 'PM Input' : q.is_woo ? 'WooCommerce' : q.is_organic ? 'Organic / Direct' : 'Unknown';
      return [
        `"${(q.job_name || 'Untitled Project').replace(/"/g, '""')}"`, 
        `"${q.quote_number || 'N/A'}"`,
        `"${q.isConverted ? 'WON (Job Created)' : q.status}"`, 
        `"${sourceCat}"`, 
        `"${q.display_campaign_name || ''}"`,
        q.optionsCount, 
        `"${q.isConverted ? 'LOCKED (WON)' : q.mode.toUpperCase()}"`, 
        q.potentialValue.toFixed(2)
      ];
    });
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Pipeline_Quotes_Report_${filters.dateRange.start}_to_${filters.dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="flex justify-center p-12 text-zinc-400"><Loader2 className="animate-spin" size={32} /></div>;

  return (
    <div>
      <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 ml-2">Potential Pipeline Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Quotes" value={data.totalQuotes} icon={<FileText className="text-blue-600" />} color="blue" />
        <StatCard title="Potential Revenue" value={`$${totalPotentialRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarSign className="text-emerald-600" />} color="emerald" />
        <StatCard title="Avg Quote Value" value={`$${avgQuoteValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={<TrendingUp className="text-purple-600" />} color="purple" />
        
        <StatCard title="Spam Jobs" value={data.spamCount} icon={<Ban className="text-red-500" />} color="red" />
        <StatCard title="Duplicates" value={data.duplicateCount} icon={<Copy className="text-amber-500" />} color="amber" />
        <StatCard title="Sent to Office" value={data.officeCount} icon={<Building className="text-zinc-500" />} color="zinc" />
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-white flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="font-bold text-lg text-zinc-900">Quotes Ledger</h2>
            <p className="text-xs text-zinc-400">Toggle calculation modes to see accurate pipeline potential.</p>
          </div>
          <button 
            onClick={handleExportQuotesCSV}
            disabled={quotesViewData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-50 shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Job / Project</th>
                <th className="px-6 py-4">Quote #</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Options</th>
                <th className="px-6 py-4 text-center">Calc Mode</th>
                <th className="px-6 py-4 text-right">Potential Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {quotesViewData.map((q) => (
                <tr key={q.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-zinc-900">{q.job_name || "Untitled Project"}</div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${q.is_paid ? 'text-amber-600' : q.is_manual ? 'text-purple-600' : 'text-zinc-400'}`}>
                      {q.is_paid ? `Paid Ad: ${q.display_campaign_name}` : q.is_manual ? 'PM Input' : q.is_woo ? 'WooCommerce' : q.is_organic ? 'Organic / Direct' : 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 font-mono font-medium">#{q.quote_number || "N/A"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                      q.isConverted ? 'bg-emerald-100 text-emerald-700' : 
                      q.status?.toUpperCase() === 'SPAM' ? 'bg-red-100 text-red-700' :
                      'bg-zinc-100 text-zinc-500'
                    }`}>
                      {q.isConverted ? 'WON (Job Created)' : q.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-zinc-700">{q.optionsCount}</td>
                  <td className="px-6 py-4">
                    {!q.isConverted ? (
                      <div className="flex justify-center">
                        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg w-fit border border-zinc-200 shadow-inner">
                          <button 
                            onClick={() => toggleCalcMode(q.id, 'avg')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${q.mode === 'avg' ? 'bg-white shadow-sm text-blue-600 border border-zinc-200' : 'text-zinc-400 hover:text-zinc-600'}`}
                          >
                            Avg
                          </button>
                          <button 
                            onClick={() => toggleCalcMode(q.id, 'sum')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${q.mode === 'sum' ? 'bg-white shadow-sm text-blue-600 border border-zinc-200' : 'text-zinc-400 hover:text-zinc-600'}`}
                          >
                            Sum
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-emerald-600 font-bold text-[10px] uppercase tracking-widest">Locked (Won)</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-mono font-black text-blue-600 text-lg">
                      ${q.potentialValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                  </td>
                </tr>
              ))}
              {quotesViewData.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-medium">No quotes found for this filter combination.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-100", emerald: "bg-emerald-50 border-emerald-100",
    purple: "bg-purple-50 border-purple-100", amber: "bg-amber-50 border-amber-100",
    zinc: "bg-zinc-50 border-zinc-200", red: "bg-red-50 border-red-100" 
  };
  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${colors[color]}`}>
      <div className="p-2 bg-white rounded-xl shadow-sm w-fit mb-4">{icon}</div>
      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black text-zinc-900 mt-1">{value}</h3>
    </div>
  );
}