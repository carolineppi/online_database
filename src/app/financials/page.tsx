'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  TrendingUp, 
  FileText, 
  DollarSign, 
  CheckCircle, 
  Calendar,
  ArrowRight
} from 'lucide-react';

export default function FinancialDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });
  const [stats, setStats] = useState({
    totalQuotes: 0,
    wonJobs: 0,
    totalRevenue: 0,
    conversionRate: 0,
    jobList: [] as any[]
  });

  const fetchFinancialData = async () => {
    setLoading(true);
    
    // 1. Fetch total quote volume for the period
    const { count: quotesCount } = await supabase
      .from('quote_submittals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);

    // 2. Fetch jobs WITH nested add-ons
    // Inside src/app/financials/page.tsx
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        created_at,
        sale_amount,
        quote_id,
        quote_submittals!fk_jobs_to_submittals (
          job_name,
          quote_number,
          add_ons (
            price
          )
        )
      `)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);

    if (jobsError) console.error("Job Fetch Error:", jobsError.message);

    // 3. Transform data to calculate "Contract Amount" (Winner + All Add-ons)
    const formattedJobs = (jobsData || []).map(job => {
      // 1. Access the first submittal in the array
      const submittalData = Array.isArray(job.quote_submittals) 
        ? job.quote_submittals[0] 
        : job.quote_submittals;

      // 2. Safely get the addons from that submittal
      const addons = submittalData?.add_ons || [];
      
      // 3. Calculate the totals
      const addonsTotal = addons.reduce((sum: number, addon: any) => sum + (Number(addon.price) || 0), 0) || 0;
      const contractAmount = (Number(job.sale_amount) || 0) + addonsTotal;

      return { 
        ...job, 
        // Flatten the submittal data so the UI can read it easily
        quote_submittals: submittalData, 
        contractAmount,
        addonCount: addons.length 
      };
    });

    // 4. Calculate total revenue using the combined contract amounts
    const totalRevenue = formattedJobs.reduce((acc, job) => acc + job.contractAmount, 0);

    setStats({
      totalQuotes: quotesCount || 0,
      wonJobs: formattedJobs.length,
      totalRevenue: totalRevenue,
      conversionRate: (quotesCount || 0) > 0 ? (formattedJobs.length / (quotesCount || 1)) * 100 : 0,
      jobList: formattedJobs
    });
    
    setLoading(false);
  };

  useEffect(() => {
    fetchFinancialData();
  }, [dateRange]);

  return (
    <div className="p-8 max-w-7xl mx-auto bg-zinc-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Financial Performance</h1>
          <p className="text-zinc-500 text-sm">Revenue calculated as Material Winner + Post-sale Add-ons.</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border shadow-sm">
          <Calendar size={18} className="text-zinc-400 ml-2" />
          <input 
            type="date" 
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            className="text-sm font-medium border-none focus:ring-0 p-1"
          />
          <ArrowRight size={14} className="text-zinc-300" />
          <input 
            type="date" 
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            className="text-sm font-medium border-none focus:ring-0 p-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Submittals Rec'd" value={stats.totalQuotes} icon={<FileText className="text-blue-600" />} color="blue" />
        <StatCard title="Jobs Created" value={stats.wonJobs} icon={<CheckCircle className="text-emerald-600" />} color="emerald" />
        <StatCard title="Win Rate" value={`${stats.conversionRate.toFixed(1)}%`} icon={<TrendingUp className="text-purple-600" />} color="purple" />
        <StatCard title="Total Value" value={`$${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-amber-600" />} color="amber" />
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-white">
          <h2 className="font-bold text-lg text-zinc-900">Revenue Ledger</h2>
          <p className="text-xs text-zinc-400">Winning material option plus associated add-on totals.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Job / Project</th>
                <th className="px-6 py-4">Quote #</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Contract Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {stats.jobList.map((job) => (
                <tr key={job.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-zinc-900">{job.quote_submittals?.job_name || "Untitled Project"}</div>
                    {job.addonCount > 0 && (
                      <div className="text-[10px] text-blue-500 font-bold uppercase tracking-tight">
                        Includes {job.addonCount} Add-on Material(s)
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    #{job.quote_submittals?.quote_number || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-mono font-bold text-emerald-600 text-lg">
                      ${job.contractAmount.toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
              {stats.jobList.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic">
                    No records found for this date range.
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

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: any, color: string }) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    purple: "bg-purple-50 border-purple-100",
    amber: "bg-amber-50 border-amber-100"
  };
  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${colors[color]}`}>
      <div className="p-2 bg-white rounded-xl shadow-sm w-fit mb-4">{icon}</div>
      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black text-zinc-900 mt-1">{value}</h3>
    </div>
  );
}