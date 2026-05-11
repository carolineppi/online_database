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
  Filter,
  CreditCard,
  Percent,
  Download,
  Briefcase,
  Layers,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function FinancialDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'jobs' | 'quotes'>('jobs');

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });
  const [campaignFilter, setCampaignFilter] = useState('all'); 
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([]); 
  
  // Stores the user's toggle preference for each quote ID ('avg' or 'sum')
  const [calcModes, setCalcModes] = useState<Record<string, 'avg' | 'sum'>>({});
  
  const [stats, setStats] = useState({
    totalQuotes: 0,
    wonJobs: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalMargin: 0,
    conversionRate: 0,
    jobList: [] as any[],
    quoteList: [] as any[]
  });

  const fetchFinancialData = async () => {
    setLoading(true);
    
    try {
      // 1. Fetch Mapping Table
      const { data: campaignsData } = await supabase.from('campaign_sources').select('*');
      const campaignMap = new Map(campaignsData?.map(c => [c.campaign_id, c.campaign_name]) || []);

      // 2. Fetch Base Queries in Parallel
      const [quotesRes, jobsRes] = await Promise.all([
        supabase.from('quote_submittals').select('id, quote_number, job_name, quote_source, campaign_source, status, created_at')
          .is('deleted_at', null)
          .gte('created_at', `${dateRange.start}T00:00:00`)
          .lte('created_at', `${dateRange.end}T23:59:59`)
          .order('created_at', { ascending: false }),
        
        supabase.from('jobs').select('id, created_at, sale_amount, actual_cost, quote_id, winning_quote_ids, accepted_individual_quote')
          .is('deleted_at', null)
          .gte('created_at', `${dateRange.start}T00:00:00`)
          .lte('created_at', `${dateRange.end}T23:59:59`)
      ]);

      const quotesInDateRange = quotesRes.data || [];
      const jobsInDateRange = jobsRes.data || [];

      // 3. Collect ALL related IDs to fetch the full picture
      const dateQuoteIds = quotesInDateRange.map(q => q.id);
      const dateJobQuoteIds = jobsInDateRange.map(j => j.quote_id);
      const allRequiredQuoteIds = Array.from(new Set([...dateQuoteIds, ...dateJobQuoteIds])).filter(Boolean);

      // 4. Fetch missing links (Jobs for the Quotes, Quotes for the Jobs) to ensure boundary consistency
      let allSubmittals = [...quotesInDateRange];
      let allJobs = [...jobsInDateRange];

      if (allRequiredQuoteIds.length > 0) {
        const missingQuoteIds = dateJobQuoteIds.filter(id => !dateQuoteIds.includes(id));
        if (missingQuoteIds.length > 0) {
          const { data: missingQuotes } = await supabase.from('quote_submittals')
            .select('id, quote_number, job_name, quote_source, campaign_source, status, created_at')
            .in('id', missingQuoteIds).is('deleted_at', null);
          if (missingQuotes) allSubmittals = [...allSubmittals, ...missingQuotes];
        }

        const dateJobIds = jobsInDateRange.map(j => j.id);
        const { data: extraJobs } = await supabase.from('jobs')
          .select('id, created_at, sale_amount, actual_cost, quote_id, winning_quote_ids, accepted_individual_quote')
          .in('quote_id', allRequiredQuoteIds).is('deleted_at', null);
        
        if (extraJobs) {
          const missingJobs = extraJobs.filter(j => !dateJobIds.includes(j.id));
          allJobs = [...allJobs, ...missingJobs];
        }
      }

      // 5. Fetch Options and Addons safely
      let allOptions: any[] = [];
      let allAddons: any[] = [];
      if (allRequiredQuoteIds.length > 0) {
        const [optsRes, addsRes] = await Promise.all([
          supabase.from('individual_quotes').select('id, quote_id, price, deleted_at').in('quote_id', allRequiredQuoteIds).is('deleted_at', null),
          supabase.from('add_ons').select('id, quote_id, price, deleted_at').in('quote_id', allRequiredQuoteIds).is('deleted_at', null)
        ]);
        if (optsRes.data) allOptions = optsRes.data;
        if (addsRes.data) allAddons = addsRes.data;
      }

      // 6. Map and Format Data Together
      const mapQuoteSource = (quote: any) => {
        const rawSource = quote.quote_source;
        const mappedName = campaignMap.get(rawSource) || quote.campaign_source || rawSource;
        const isManual = rawSource === 'PM Input';
        const isPaid = campaignMap.has(rawSource) || (!isManual && rawSource !== 'Organic / Direct' && rawSource !== 'Unknown' && !isNaN(Number(rawSource)));
        return { ...quote, display_campaign_name: mappedName, is_paid: isPaid, is_manual: isManual };
      };

      const submittalsMap = new Map();
      allSubmittals.forEach(q => {
        const mapped = mapQuoteSource(q);
        mapped.options = allOptions.filter(o => o.quote_id === q.id);
        mapped.addons = allAddons.filter(a => a.quote_id === q.id);
        mapped.addonsTotal = mapped.addons.reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);
        mapped.linkedJob = allJobs.find(j => j.quote_id === q.id); 
        submittalsMap.set(q.id, mapped);
      });

      // Format Jobs List (Only those created IN the date range)
      const formattedJobs = jobsInDateRange.map(job => {
        const submittal = submittalsMap.get(job.quote_id);
        if (!submittal) return null;

        const contractAmount = (Number(job.sale_amount) || 0) + submittal.addonsTotal;
        const costAmount = Number(job.actual_cost) || 0;
        const profit = contractAmount - costAmount;
        const margin = contractAmount > 0 ? (profit / contractAmount) * 100 : 0;

        return { 
          ...job, 
          quote_submittals: submittal, 
          contractAmount, costAmount, profit, margin,
          addonCount: submittal.addons.length 
        };
      })
      .filter((job): job is any => job !== null) // <-- Explicit Type Guard for TS compiler
      .filter((job: any) => {
        if (campaignFilter === 'all') return true;
        if (campaignFilter === 'paid') return job.quote_submittals.is_paid;
        if (campaignFilter === 'organic') return !job.quote_submittals.is_paid && !job.quote_submittals.is_manual;
        if (campaignFilter === 'manual') return job.quote_submittals.is_manual;
        return job.quote_submittals.display_campaign_name === campaignFilter;
      });

      // Format Quotes List (Only those created IN the date range)
      const formattedQuotes = quotesInDateRange.map(q => submittalsMap.get(q.id))
      .filter((q): q is any => q !== null) // <-- Explicit Type Guard for TS compiler
      .filter((q: any) => {
        if (campaignFilter === 'all') return true;
        if (campaignFilter === 'paid') return q.is_paid;
        if (campaignFilter === 'organic') return !q.is_paid && !q.is_manual;
        if (campaignFilter === 'manual') return q.is_manual;
        return q.display_campaign_name === campaignFilter;
      });

      const uniqueCampaigns = Array.from(new Set(
        allSubmittals.map(mapQuoteSource).filter(q => q.is_paid).map(q => q.display_campaign_name)
      )) as string[];
      setAvailableCampaigns(uniqueCampaigns);

      // Aggregates
      const totalRevenue = formattedJobs.reduce((acc, job: any) => acc + job.contractAmount, 0); // Added : any
      const totalCost = formattedJobs.reduce((acc, job: any) => acc + job.costAmount, 0); // Added : any
      const totalProfit = totalRevenue - totalCost;
      const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      setStats({
        totalQuotes: formattedQuotes.length,
        wonJobs: formattedJobs.length,
        totalRevenue: totalRevenue,
        totalCost: totalCost,
        totalProfit: totalProfit,
        totalMargin: totalMargin,
        conversionRate: formattedQuotes.length > 0 ? (formattedJobs.length / formattedQuotes.length) * 100 : 0,
        jobList: formattedJobs,
        quoteList: formattedQuotes
      });

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load dashboard data.");
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchFinancialData();
  }, [dateRange, campaignFilter]);

  // --- DYNAMIC QUOTE CALCULATIONS ---
  const toggleCalcMode = (id: string, mode: 'avg' | 'sum') => {
    setCalcModes(prev => ({ ...prev, [id]: mode }));
  };

  const quotesViewData = stats.quoteList.map(q => {
    const mode = calcModes[q.id] || 'avg';
    const isConverted = q.status === 'WON' || !!q.linkedJob;
    const optionsCount = q.options.length;
    
    let baseValue = 0;
    
    if (isConverted && q.linkedJob) {
      // EXCEPTION: It's a Won Job! Sum only the selected winners
      const winningIds = q.linkedJob.winning_quote_ids || (q.linkedJob.accepted_individual_quote ? [q.linkedJob.accepted_individual_quote] : []);
      const winningOptions = q.options.filter((o: any) => winningIds.includes(o.id));
      baseValue = winningOptions.reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0);
    } else {
      // Standard open quote pipeline calculation
      const optionsSum = q.options.reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0);
      if (optionsCount > 0) {
        baseValue = mode === 'avg' ? optionsSum / optionsCount : optionsSum;
      }
    }
    
    const potentialValue = baseValue + q.addonsTotal;

    return { ...q, mode, potentialValue, optionsCount, isConverted };
  });

  const totalPotentialRevenue = quotesViewData.reduce((sum, q: any) => sum + q.potentialValue, 0); // Added : any
  const avgQuoteValue = quotesViewData.length > 0 ? totalPotentialRevenue / quotesViewData.length : 0;
  const avgDealSize = stats.wonJobs > 0 ? stats.totalRevenue / stats.wonJobs : 0;

  // --- EXPORTS ---
  const handleExportJobsCSV = () => {
    if (stats.jobList.length === 0) return;
    const headers = ['Job / Project Name', 'Quote #', 'Marketing Category', 'Specific Campaign', 'Contract Amount', 'Estimated Cost', 'Gross Profit', 'Gross Margin (%)'];
    const rows = stats.jobList.map(job => {
      const sourceCat = job.quote_submittals.is_paid ? 'Paid Ad' : job.quote_submittals.is_manual ? 'PM Input' : (job.quote_submittals.quote_source || 'Unknown');
      return [
        `"${(job.quote_submittals?.job_name || 'Untitled Project').replace(/"/g, '""')}"`,
        `"${job.quote_submittals?.quote_number || 'N/A'}"`, `"${sourceCat}"`, `"${job.quote_submittals.display_campaign_name || ''}"`,
        job.contractAmount.toFixed(2), job.costAmount.toFixed(2), job.profit.toFixed(2), job.margin.toFixed(1)
      ];
    });
    triggerDownload(headers, rows, `Closed_Jobs_Report_${dateRange.start}_to_${dateRange.end}.csv`);
  };

  const handleExportQuotesCSV = () => {
    if (quotesViewData.length === 0) return;
    const headers = ['Project Name', 'Quote #', 'Status', 'Marketing Category', 'Specific Campaign', 'Options Count', 'Calculation Mode', 'Potential Revenue'];
    const rows = quotesViewData.map(q => {
      const sourceCat = q.is_paid ? 'Paid Ad' : q.is_manual ? 'PM Input' : (q.quote_source || 'Unknown');
      return [
        `"${(q.job_name || 'Untitled Project').replace(/"/g, '""')}"`, `"${q.quote_number || 'N/A'}"`,
        `"${q.isConverted ? 'WON (Job Created)' : q.status}"`, `"${sourceCat}"`, `"${q.display_campaign_name || ''}"`,
        q.optionsCount, `"${q.isConverted ? 'LOCKED (WON)' : q.mode.toUpperCase()}"`, q.potentialValue.toFixed(2)
      ];
    });
    triggerDownload(headers, rows, `Pipeline_Quotes_Report_${dateRange.start}_to_${dateRange.end}.csv`);
  };

  const triggerDownload = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400 gap-3">
        <Loader2 className="animate-spin" size={32} />
        <p className="font-bold uppercase tracking-widest text-xs">Crunching numbers...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-zinc-50 min-h-screen">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Financial Performance</h1>
          <p className="text-zinc-500 text-sm">Analyze pipeline potential and closed revenue.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border shadow-sm">
            <Filter size={16} className="text-zinc-400" />
            <select 
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="text-sm font-bold border-none focus:ring-0 bg-transparent outline-none cursor-pointer"
            >
              <option value="all">All Channels</option>
              <option value="paid">All Paid Ads</option>
              <option value="organic">Organic / Direct</option>
              <option value="manual">PM Input</option>
              <option disabled>──────────</option>
              {availableCampaigns.map(camp => (
                <option key={camp} value={camp}>Campaign: {camp}</option>
              ))}
            </select>
          </div>

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

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 mb-8 bg-zinc-200/50 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
            activeTab === 'jobs' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <Briefcase size={16} /> Closed Jobs
        </button>
        <button 
          onClick={() => setActiveTab('quotes')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
            activeTab === 'quotes' ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <Layers size={16} /> Pipeline Quotes
        </button>
      </div>

      {/* =========================================
          TAB 1: CLOSED JOBS VIEW
      ============================================= */}
      {activeTab === 'jobs' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          {/* PIPELINE METRICS */}
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 ml-2">Conversion Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <StatCard title="Total Quotes" value={stats.totalQuotes} icon={<FileText className="text-blue-600" />} color="blue" />
            <StatCard title="Closed Deals" value={stats.wonJobs} icon={<CheckCircle className="text-emerald-600" />} color="emerald" />
            <StatCard title="Win Rate" value={`${stats.conversionRate.toFixed(1)}%`} icon={<Target className="text-purple-600" />} color="purple" />
            <StatCard title="Avg Deal Size" value={`$${avgDealSize.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={<DollarSign className="text-zinc-600" />} color="zinc" />
          </div>

          {/* FINANCIAL METRICS */}
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 ml-2">Financial Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <StatCard title="Total Revenue" value={`$${stats.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarSign className="text-emerald-600" />} color="emerald" />
            <StatCard title="Total Cost" value={`$${stats.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<CreditCard className="text-amber-600" />} color="amber" />
            <StatCard title="Gross Profit" value={`$${stats.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<TrendingUp className="text-blue-600" />} color="blue" />
            <StatCard title="Gross Margin" value={`${stats.totalMargin.toFixed(1)}%`} icon={<Percent className="text-purple-600" />} color="purple" />
          </div>

          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-white flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="font-bold text-lg text-zinc-900">Revenue Ledger</h2>
                <p className="text-xs text-zinc-400">Attributed by campaign source with detailed costing.</p>
              </div>
              <button 
                onClick={handleExportJobsCSV}
                disabled={stats.jobList.length === 0}
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
                    <th className="px-6 py-4">Marketing Source</th>
                    <th className="px-6 py-4">Quote #</th>
                    <th className="px-6 py-4 text-right">Contract Amount</th>
                    <th className="px-6 py-4 text-right">Actual Cost</th>
                    <th className="px-6 py-4 text-right">Gross Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {stats.jobList.map((job) => (
                    <tr key={job.id} className="hover:bg-zinc-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-zinc-900">{job.quote_submittals?.job_name || "Untitled Project"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${job.quote_submittals.is_paid ? 'text-amber-600' : job.quote_submittals.is_manual ? 'text-purple-600' : 'text-zinc-400'}`}>
                            {job.quote_submittals.is_paid ? 'Paid Ad' : job.quote_submittals.is_manual ? 'PM Input' : (job.quote_submittals.quote_source || 'Unknown')}
                          </span>
                          {job.quote_submittals.is_paid && job.quote_submittals.display_campaign_name && (
                            <span className="text-xs text-zinc-800 font-bold mt-0.5">{job.quote_submittals.display_campaign_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-500 font-mono font-medium">#{job.quote_submittals?.quote_number || "N/A"}</td>
                      <td className="px-6 py-4 text-right font-mono font-black text-emerald-600 text-base">
                        ${job.contractAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-amber-600 text-base">
                        ${job.costAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-mono font-black text-blue-600 text-base">${job.profit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div className="text-[10px] text-zinc-400 font-black tracking-widest mt-0.5 uppercase">{job.margin.toFixed(1)}% Margin</div>
                      </td>
                    </tr>
                  ))}
                  {stats.jobList.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-medium">No closed revenue found for this filter combination.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          TAB 2: PIPELINE QUOTES VIEW
      ============================================= */}
      {activeTab === 'quotes' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 ml-2">Potential Pipeline Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard title="Total Quotes" value={stats.totalQuotes} icon={<FileText className="text-blue-600" />} color="blue" />
            <StatCard title="Potential Revenue" value={`$${totalPotentialRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarSign className="text-emerald-600" />} color="emerald" />
            <StatCard title="Avg Quote Value" value={`$${avgQuoteValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={<TrendingUp className="text-purple-600" />} color="purple" />
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
                          {q.is_paid ? `Paid Ad: ${q.display_campaign_name}` : q.is_manual ? 'PM Input' : (q.quote_source || 'Unknown')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-500 font-mono font-medium">#{q.quote_number || "N/A"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                          q.isConverted ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
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
      )}

    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: any, color: string }) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    purple: "bg-purple-50 border-purple-100",
    amber: "bg-amber-50 border-amber-100",
    zinc: "bg-zinc-50 border-zinc-200"
  };
  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${colors[color]}`}>
      <div className="p-2 bg-white rounded-xl shadow-sm w-fit mb-4">{icon}</div>
      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black text-zinc-900 mt-1">{value}</h3>
    </div>
  );
}