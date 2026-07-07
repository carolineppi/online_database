'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Target, TrendingUp, DollarSign, PieChart, Download, Loader2, MousePointerClick } from 'lucide-react';

export default function CohortAnalysisTab({ filters }: { filters: any }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const [data, setData] = useState({
    cohortQuotes: 0,
    cohortWon: 0,
    cohortRevenue: 0,
    cohortProfit: 0,
    groupedData: [] as any[]
  });

  useEffect(() => {
    const fetchCohortData = async () => {
      setLoading(true);
      try {
        const [quotesRes, campaignRes] = await Promise.all([
          supabase.from('quote_submittals')
            .select('*')
            .gte('created_at', filters.exactStart)
            .lte('created_at', filters.exactEnd)
            .is('deleted_at', null),
          supabase.from('campaign_sources').select('*')
        ]);

        const rawQuotes = quotesRes.data || [];
        const campaignMap = new Map(campaignRes.data?.map(c => [c.campaign_id, c.campaign_name]) || []);

        const quoteIds = rawQuotes.map(q => q.id);
        let addonsData: any[] = [];
        let jobsData: any[] = [];

        // Manually fetch associated jobs and addons by Quote IDs
        if (quoteIds.length > 0) {
          const [aRes, jRes] = await Promise.all([
            supabase.from('add_ons').select('price, quote_id').in('quote_id', quoteIds).is('deleted_at', null),
            supabase.from('jobs').select('id, quote_id, sale_amount, actual_cost').in('quote_id', quoteIds).is('deleted_at', null)
          ]);
          addonsData = aRes.data || [];
          jobsData = jRes.data || [];
        }

        let totalQuotes = 0;
        let totalWon = 0;
        let totalRevenue = 0;
        let totalCost = 0;

        const groups = new Map();

        rawQuotes.forEach((q: any) => {
          // Standard Category Logic
          const isWoo = q.source === 'WooCommerce';
          const isManual = q.quote_source === 'PM Input';
          const isOrganic = q.quote_source === 'Organic / Direct';
          const isPaid = /^\d+$/.test(q.quote_source || ''); 
          const displayCampaign = isPaid ? (campaignMap.get(q.quote_source) || q.quote_source) : 'Unknown';

          // Apply Global Filters
          if (filters.originFilter === 'woo' && !isWoo) return;
          if (filters.originFilter === 'manual' && !isManual) return;
          if (filters.originFilter === 'organic' && !isOrganic) return;
          if (filters.campaignFilter !== 'all' && displayCampaign !== filters.campaignFilter) return;

          totalQuotes++;

          // Determine Group Key 
          const groupKey = isPaid ? `Paid Ad: ${displayCampaign}` : isManual ? 'PM Input' : isWoo ? 'WooCommerce' : isOrganic ? 'Organic / Direct' : 'Unknown';

          if (!groups.has(groupKey)) {
            groups.set(groupKey, { name: groupKey, isPaid, quotes: 0, won: 0, revenue: 0, cost: 0 });
          }

          const g = groups.get(groupKey);
          g.quotes += 1;

          // Trace forward to see if it became a job
          const job = jobsData.find(j => j.quote_id === q.id);
          if (job) {
            const addonsSum = addonsData.filter(a => a.quote_id === q.id).reduce((sum, a) => sum + (Number(a.price) || 0), 0);
            const contract = (Number(job.sale_amount) || 0) + addonsSum;
            const actualCost = Number(job.actual_cost) || 0;

            totalWon++;
            totalRevenue += contract;
            totalCost += actualCost;

            g.won += 1;
            g.revenue += contract;
            g.cost += actualCost;
          }
        });

        const finalGroupedData = Array.from(groups.values()).map(g => {
          const profit = g.revenue - g.cost;
          const margin = g.revenue > 0 ? (profit / g.revenue) * 100 : 0;
          const winRate = g.quotes > 0 ? (g.won / g.quotes) * 100 : 0;
          return { ...g, profit, margin, winRate };
        });

        finalGroupedData.sort((a, b) => b.revenue - a.revenue);

        setData({
          cohortQuotes: totalQuotes,
          cohortWon: totalWon,
          cohortRevenue: totalRevenue,
          cohortProfit: totalRevenue - totalCost,
          groupedData: finalGroupedData
        });

      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchCohortData();
  }, [filters, supabase]);

  const handleExportCohortCSV = () => {
    if (data.groupedData.length === 0) return;
    const headers = ['Marketing Source', 'Quotes Generated', 'Deals Won', 'Win Rate (%)', 'Realized Revenue', 'Realized Cost', 'Realized Gross Profit', 'Gross Margin (%)'];
    const rows = data.groupedData.map(g => [
      `"${g.name}"`, g.quotes, g.won, g.winRate.toFixed(1), g.revenue.toFixed(2), g.cost.toFixed(2), g.profit.toFixed(2), g.margin.toFixed(1)
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Cohort_ROI_Report_${filters.dateRange.start}_to_${filters.dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cohortWinRate = data.cohortQuotes > 0 ? (data.cohortWon / data.cohortQuotes) * 100 : 0;

  if (loading) return <div className="flex justify-center p-12 text-zinc-400"><Loader2 className="animate-spin" size={32} /></div>;

  return (
    <div>
      <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 ml-2">Cohort Lifecycle Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Cohort Quotes" value={data.cohortQuotes} icon={<Target className="text-blue-600" />} color="blue" />
        <StatCard title="Cohort Closed Deals" value={data.cohortWon} icon={<MousePointerClick className="text-emerald-600" />} color="emerald" />
        <StatCard title="Cohort Win Rate" value={`${cohortWinRate.toFixed(1)}%`} icon={<PieChart className="text-purple-600" />} color="purple" />
        <StatCard title="Realized Gross Profit" value={`$${data.cohortProfit.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`} icon={<TrendingUp className="text-amber-600" />} color="amber" />
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-white flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="font-bold text-lg text-zinc-900">ROI Attribution Ledger</h2>
            <p className="text-xs text-zinc-400">Evaluating marketing performance based on the date the quote was acquired.</p>
          </div>
          <button 
            onClick={handleExportCohortCSV}
            disabled={data.groupedData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-50 shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Marketing Source</th>
                <th className="px-6 py-4 text-center">Quotes</th>
                <th className="px-6 py-4 text-center">Won Jobs</th>
                <th className="px-6 py-4 text-center">Win Rate</th>
                <th className="px-6 py-4 text-right">Realized Revenue</th>
                <th className="px-6 py-4 text-right">Realized Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.groupedData.map((g, idx) => (
                <tr key={idx} className="hover:bg-zinc-50/50 transition">
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${
                      g.isPaid ? 'bg-amber-100 text-amber-700' : 
                      g.name === 'PM Input' ? 'bg-purple-100 text-purple-700' :
                      g.name === 'WooCommerce' ? 'bg-blue-100 text-blue-700' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>
                      {g.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-zinc-700">{g.quotes}</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-600">{g.won}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="font-bold text-zinc-700">{g.winRate.toFixed(1)}%</div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-black text-zinc-900">
                    ${g.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-mono font-black text-blue-600 text-base">
                      ${g.profit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                    {g.revenue > 0 && (
                      <div className="text-[10px] text-zinc-400 font-black tracking-widest mt-0.5 uppercase">
                        {g.margin.toFixed(1)}% Margin
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {data.groupedData.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-medium">No cohort data found for this filter combination.</td></tr>
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
  };
  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${colors[color]}`}>
      <div className="p-2 bg-white rounded-xl shadow-sm w-fit mb-4">{icon}</div>
      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black text-zinc-900 mt-1">{value}</h3>
    </div>
  );
}