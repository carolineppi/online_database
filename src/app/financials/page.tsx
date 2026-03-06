'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  TrendingUp, 
  FileText, 
  DollarSign, 
  CheckCircle, 
  Calendar,
  ArrowRight,
  Target, // Added icon for marketing
  Filter
} from 'lucide-react';

export default function FinancialDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });
  const [campaignFilter, setCampaignFilter] = useState('all'); // New filter state
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([]); // To populate dropdown
  
  const [stats, setStats] = useState({
    totalQuotes: 0,
    wonJobs: 0,
    totalRevenue: 0,
    conversionRate: 0,
    jobList: [] as any[]
  });

  const fetchFinancialData = async () => {
    setLoading(true);
    
    // 1. Fetch submittals with count and marketing source
    let quotesQuery = supabase
      .from('quote_submittals')
      .select('id, quote_source, campaign_source', { count: 'exact' })
      .is('deleted_at', null) // Filter out trashed submittals
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);

    // Apply campaign filters to the total quote count
    if (campaignFilter === 'paid') {
      quotesQuery = quotesQuery.neq('quote_source', 'Direct');
    } else if (campaignFilter !== 'all') {
      quotesQuery = quotesQuery.eq('campaign_source', campaignFilter);
    }

    const { count: quotesCount, data: allQuotesData } = await quotesQuery;

    // Extract unique campaigns for the filter dropdown
    const campaigns = Array.from(new Set(
      (allQuotesData || [])
        .map(q => q.campaign_source)
        .filter(Boolean)
    )) as string[];
    setAvailableCampaigns(campaigns);

    // 2. Fetch jobs with submittal marketing data
    let jobsQuery = supabase
      .from('jobs')
      .select(`
        id,
        created_at,
        sale_amount,
        quote_id,
        quote_submittals!fk_jobs_to_submittals (
          job_name,
          quote_number,
          quote_source,
          campaign_source,
          deleted_at,
          add_ons (
            price,
            deleted_at
          )
        )
      `)
      .is('deleted_at', null) // Filter out trashed jobs
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);

    const { data: jobsData, error: jobsError } = await jobsQuery;
    if (jobsError) console.error("Job Fetch Error:", jobsError.message);

    // 3. Filter and Transform data
    const formattedJobs = (jobsData || [])
      .map(job => {
        const submittalData = Array.isArray(job.quote_submittals) 
          ? job.quote_submittals[0] 
          : job.quote_submittals;

        // if (submittalData?.deleted_at) return null;

        const activeAddons = (submittalData?.add_ons || []).filter((a: any) => !a.deleted_at);
        const addonsTotal = activeAddons.reduce((sum: number, addon: any) => sum + (Number(addon.price) || 0), 0) || 0;
        const contractAmount = (Number(job.sale_amount) || 0) + addonsTotal;

        return { 
          ...job, 
          quote_submittals: submittalData, 
          contractAmount,
          addonCount: activeAddons.length 
        };
      })
      // Filter the jobs list by the selected campaign
      .filter(job => {
        if (campaignFilter === 'all') return true;
        if (campaignFilter === 'paid') return job.quote_submittals?.quote_source !== 'Direct';
        return job.quote_submittals?.campaign_source === campaignFilter;
      });

    // 4. Calculate total revenue
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
  }, [dateRange, campaignFilter]); // Refetch when filter changes

  return (
    <div className="p-8 max-w-7xl mx-auto bg-zinc-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Financial Performance</h1>
          <p className="text-zinc-500 text-sm">Revenue attribution by marketing campaign.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Campaign Filter Dropdown */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border shadow-sm">
            <Filter size={16} className="text-zinc-400" />
            <select 
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="text-sm font-bold border-none focus:ring-0 bg-transparent"
            >
              <option value="all">All Channels</option>
              <option value="paid">All Paid Ads</option>
              {availableCampaigns.map(camp => (
                <option key={camp} value={camp}>Campaign: {camp}</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Quotes" value={stats.totalQuotes} icon={<FileText className="text-blue-600" />} color="blue" />
        <StatCard title="Closed Revenue" value={stats.wonJobs} icon={<CheckCircle className="text-emerald-600" />} color="emerald" />
        <StatCard title="Win Rate" value={`${stats.conversionRate.toFixed(1)}%`} icon={<TrendingUp className="text-purple-600" />} color="purple" />
        <StatCard title="Total Value" value={`$${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-amber-600" />} color="amber" />
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-white flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-zinc-900">Revenue Ledger</h2>
            <p className="text-xs text-zinc-400">Attributed by campaign source.</p>
          </div>
          {campaignFilter !== 'all' && (
            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
              <Target size={12} /> {campaignFilter} Filter Active
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Job / Project</th>
                <th className="px-6 py-4">Marketing Source</th> {/* New Column */}
                <th className="px-6 py-4">Quote #</th>
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
                        Includes {job.addonCount} Add-on(s)
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black uppercase ${job.quote_submittals?.quote_source !== 'Direct' ? 'text-amber-600' : 'text-zinc-400'}`}>
                        {job.quote_submittals?.quote_source || 'Unknown'}
                      </span>
                      {job.quote_submittals?.campaign_source && (
                        <span className="text-xs text-zinc-500 font-medium">
                          ID: {job.quote_submittals.campaign_source}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 font-mono">
                    #{job.quote_submittals?.quote_number || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-mono font-bold text-emerald-600 text-lg">
                      ${job.contractAmount.toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
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