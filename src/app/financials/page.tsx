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
  Target,
  Filter
} from 'lucide-react';

export default function FinancialDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });
  const [campaignFilter, setCampaignFilter] = useState('all'); 
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([]); 
  
  const [stats, setStats] = useState({
    totalQuotes: 0,
    wonJobs: 0,
    totalRevenue: 0,
    conversionRate: 0,
    jobList: [] as any[]
  });

  const fetchFinancialData = async () => {
    setLoading(true);
    
    // 1. Fetch Mapping Table
    const { data: campaignsData } = await supabase.from('campaign_sources').select('*');
    const campaignMap = new Map(campaignsData?.map(c => [c.campaign_id, c.campaign_name]) || []);

    // 2. Fetch all active submittals in the date range to calculate true quote volume
    const { data: allQuotesData } = await supabase
        .from('quote_submittals')
        .select('id, quote_source, campaign_source')
        .is('deleted_at', null) 
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`);

    // Helper function to map a quote's source
    const mapQuoteSource = (quote: any) => {
      const rawSource = quote.quote_source;
      const mappedName = campaignMap.get(rawSource) || quote.campaign_source || rawSource;
      const isManual = rawSource === 'PM Input';
      const isPaid = campaignMap.has(rawSource) || (!isManual && rawSource !== 'Organic / Direct' && rawSource !== 'Unknown' && !isNaN(Number(rawSource)));
      return { ...quote, display_campaign_name: mappedName, is_paid: isPaid, is_manual: isManual };
    };

    // Map all quotes and filter them based on the current dropdown selection
    const mappedQuotes = (allQuotesData || []).map(mapQuoteSource);
    const filteredQuotes = mappedQuotes.filter(q => {
      if (campaignFilter === 'all') return true;
      if (campaignFilter === 'paid') return q.is_paid;
      return q.display_campaign_name === campaignFilter;
    });

    // Extract unique campaign names for the dropdown filter
    const uniqueCampaigns = Array.from(new Set(
      mappedQuotes.filter(q => q.is_paid).map(q => q.display_campaign_name)
    )) as string[];
    setAvailableCampaigns(uniqueCampaigns);

    // 3. Fetch Jobs
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
          quote_source,
          campaign_source,
          deleted_at,
          add_ons (
            price,
            deleted_at
          )
        )
      `)
      .is('deleted_at', null)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);
    
    if (jobsError) {
      console.error("Job Fetch Error:", jobsError.message);
      setLoading(false);
      return;
    }

    // 4. Transform and Filter Jobs Data
    const formattedJobs = (jobsData || [])
      .map(job => {
        const submittalData = Array.isArray(job.quote_submittals) ? job.quote_submittals[0] : job.quote_submittals;
        
        // Skip if parent is deleted
        if (!submittalData || submittalData.deleted_at) return null;

        // Calculate Add-ons
        const activeAddons = (submittalData.add_ons || []).filter((a: any) => !a.deleted_at);
        const addonsTotal = activeAddons.reduce((sum: number, addon: any) => sum + (Number(addon.price) || 0), 0) || 0;
        const contractAmount = (Number(job.sale_amount) || 0) + addonsTotal;

        // Apply Mapping
        const mappedSubmittal = mapQuoteSource(submittalData);

        return { 
          ...job, 
          quote_submittals: mappedSubmittal, 
          contractAmount,
          addonCount: activeAddons.length 
        };
      })
      .filter((job): job is any => job !== null)
      .filter(job => {
        if (campaignFilter === 'all') return true;
        if (campaignFilter === 'paid') return job.quote_submittals.is_paid;
        return job.quote_submittals.display_campaign_name === campaignFilter;
      });

    // 5. Final Calculations
    const totalRevenue = formattedJobs.reduce((acc, job) => acc + job.contractAmount, 0);
    const quotesCount = filteredQuotes.length;

    setStats({
      totalQuotes: quotesCount,
      wonJobs: formattedJobs.length,
      totalRevenue: totalRevenue,
      conversionRate: quotesCount > 0 ? (formattedJobs.length / quotesCount) * 100 : 0,
      jobList: formattedJobs
    });
    
    setLoading(false);
  };

  useEffect(() => {
    fetchFinancialData();
  }, [dateRange, campaignFilter]);

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
              className="text-sm font-bold border-none focus:ring-0 bg-transparent outline-none cursor-pointer"
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
              className="text-sm font-medium border-none focus:ring-0 p-1 outline-none cursor-pointer"
            />
            <ArrowRight size={14} className="text-zinc-300" />
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="text-sm font-medium border-none focus:ring-0 p-1 outline-none cursor-pointer"
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
                <th className="px-6 py-4">Marketing Source</th>
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
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        job.quote_submittals.is_paid 
                          ? 'text-amber-600' 
                          : job.quote_submittals.is_manual 
                            ? 'text-purple-600' 
                            : 'text-zinc-400'
                      }`}>
                        {job.quote_submittals.is_paid 
                          ? 'Paid Ad' 
                          : job.quote_submittals.is_manual 
                            ? 'PM Input' 
                            : (job.quote_submittals.quote_source || 'Unknown')}
                      </span>
                      {job.quote_submittals.is_paid && job.quote_submittals.display_campaign_name && (
                        <span className="text-xs text-zinc-800 font-bold mt-0.5">
                          {job.quote_submittals.display_campaign_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 font-mono font-medium">
                    #{job.quote_submittals?.quote_number || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-mono font-black text-emerald-600 text-lg">
                      ${job.contractAmount.toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
              {stats.jobList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    No closed revenue found for this filter combination.
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