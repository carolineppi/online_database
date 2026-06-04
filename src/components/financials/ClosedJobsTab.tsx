'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TrendingUp, DollarSign, CreditCard, Percent, Loader2, Clock } from 'lucide-react';

export default function ClosedJobsTab({ filters }: { filters: any }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    jobsList: [] as any[],
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalMargin: 0,
    avgVelocity: 0
  });

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        // We strictly query JOBS by their creation date (Decoupled Time Axis)
        const { data: rawJobs } = await supabase
          .from('jobs')
          .select('*, quote_submittals(*, add_ons(price))')
          .gte('created_at', `${filters.dateRange.start}T00:00:00`)
          .lte('created_at', `${filters.dateRange.end}T23:59:59`)
          .is('deleted_at', null);

        if (!rawJobs) return;

        let filteredJobs = rawJobs.filter(job => {
          const sub = job.quote_submittals;
          if (!sub) return false;

          // 1. Origin Filter
          const isWoo = sub.source === 'WooCommerce';
          const isManual = sub.quote_source === 'PM Input';
          if (filters.originFilter === 'woo' && !isWoo) return false;
          if (filters.originFilter === 'manual' && !isManual) return false;
          if (filters.originFilter === 'organic' && (isWoo || isManual)) return false;

          // 2. Campaign Filter
          if (filters.campaignFilter !== 'all') {
            const campName = sub.campaign_source || sub.quote_source;
            if (campName !== filters.campaignFilter) return false;
          }
          return true;
        });

        let revenue = 0, cost = 0, velocityDays = 0;

        const processedJobs = filteredJobs.map(job => {
          const addonsSum = job.quote_submittals.add_ons?.reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0) || 0;
          const contract = (Number(job.sale_amount) || 0) + addonsSum;
          const actualCost = Number(job.actual_cost) || 0;
          
          revenue += contract;
          cost += actualCost;

          // Sales Velocity: Days between Quote Creation and Job Creation
          const qDate = new Date(job.quote_submittals.created_at).getTime();
          const jDate = new Date(job.created_at).getTime();
          const daysToClose = Math.max(0, (jDate - qDate) / (1000 * 3600 * 24));
          velocityDays += daysToClose;

          return { ...job, contract, actualCost, profit: contract - actualCost, daysToClose };
        });

        setData({
          jobsList: processedJobs,
          totalRevenue: revenue,
          totalCost: cost,
          totalProfit: revenue - cost,
          totalMargin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
          avgVelocity: processedJobs.length > 0 ? velocityDays / processedJobs.length : 0
        });

      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchJobs();
  }, [filters, supabase]);

  if (loading) return <div className="flex justify-center p-12 text-zinc-400"><Loader2 className="animate-spin" size={32} /></div>;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard title="Total Revenue" value={`$${data.totalRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={<DollarSign className="text-emerald-600"/>} color="emerald" />
        <StatCard title="Total Cost" value={`$${data.totalCost.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={<CreditCard className="text-amber-600"/>} color="amber" />
        <StatCard title="Gross Profit" value={`$${data.totalProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={<TrendingUp className="text-blue-600"/>} color="blue" />
        <StatCard title="Gross Margin" value={`${data.totalMargin.toFixed(1)}%`} icon={<Percent className="text-purple-600"/>} color="purple" />
        {/* NEW: Sales Velocity Metric */}
        <StatCard title="Avg Time to Close" value={`${data.avgVelocity.toFixed(1)} Days`} icon={<Clock className="text-zinc-600"/>} color="zinc" />
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-white">
          <h2 className="font-bold text-lg text-zinc-900">Closed Deals</h2>
          <p className="text-xs text-zinc-400">Jobs officially created within this period.</p>
        </div>
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">Job Name</th>
              <th className="px-6 py-4">Date Won</th>
              <th className="px-6 py-4">Days to Close</th>
              <th className="px-6 py-4 text-right">Contract</th>
              <th className="px-6 py-4 text-right">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {data.jobsList.map(job => (
              <tr key={job.id} className="hover:bg-zinc-50 transition">
                <td className="px-6 py-4 font-bold text-zinc-900">{job.quote_submittals?.job_name || "Untitled"}</td>
                <td className="px-6 py-4 text-zinc-500">{new Date(job.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 font-medium text-zinc-700">{job.daysToClose.toFixed(0)} Days</td>
                <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">${job.contract.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="px-6 py-4 text-right font-mono font-bold text-blue-600">${job.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-100", emerald: "bg-emerald-50 border-emerald-100",
    purple: "bg-purple-50 border-purple-100", amber: "bg-amber-50 border-amber-100",
    zinc: "bg-zinc-50 border-zinc-200"
  };
  return (
    <div className={`p-4 rounded-3xl border shadow-sm ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">{icon} <span className="text-[10px] font-bold text-zinc-500 uppercase">{title}</span></div>
      <h3 className="text-xl font-black text-zinc-900">{value}</h3>
    </div>
  );
}