'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  Briefcase, Layers, Target, TrendingUp, Users, Award,
  Filter, Calendar, ArrowRight, ShoppingCart
} from 'lucide-react';
import ClosedJobsTab from '@/components/financials/ClosedJobsTab';
import CustomerAnalysisTab from '@/components/financials/CustomerAnalysisTab';
import PipelineQuotesTab from '@/components/financials/PipelineQuotesTab';
import CohortAnalysisTab from '@/components/financials/CohortAnalysisTab';
import MonthOverMonthTab from '@/components/financials/MonthOverMonthTab';
// import PmLeaderboardTab from '@/components/financials/PmLeaderboardTab';

export type TabType = 'jobs' | 'quotes' | 'cohort' | 'mom' | 'customers' | 'leaderboard';

export default function FinancialDashboard() {
  const supabase = createClient();
  
  // Global Filter States
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });
  const [campaignFilter, setCampaignFilter] = useState('all'); 
  const [originFilter, setOriginFilter] = useState('all'); // 'all', 'woo', 'manual', 'organic'
  
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('jobs');

  // Fetch unique campaigns for the dropdown
  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase.from('campaign_sources').select('campaign_name');
      if (data) {
        const unique = Array.from(new Set(data.map(c => c.campaign_name)));
        setAvailableCampaigns(unique);
      }
    };
    fetchCampaigns();
  }, [supabase]);

// NEW: Locks the boundary to exactly Midnight Eastern Time, respecting DST
  const getEasternISO = (dateString: string, isEnd: boolean) => {
    if (!dateString) return '';
    const time = isEnd ? '23:59:59.999' : '00:00:00.000';
    // Use Noon UTC to safely determine if this specific day is EST or EDT
    const d = new Date(`${dateString}T12:00:00Z`);
    const tzString = d.toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" });
    const offset = tzString.includes("EDT") ? "-04:00" : "-05:00";
    return `${dateString}T${time}${offset}`;
  };

  // Pack filters into a single object to pass as props cleanly
  const filters = {
    dateRange,
    exactStart: getEasternISO(dateRange.start, false),
    exactEnd: getEasternISO(dateRange.end, true),
    campaignFilter,
    originFilter
  };

  return (
    <main className="pl-64 min-h-screen bg-gray-50">
      <div className="p-8 max-w-7xl mx-auto">
        
        {/* HEADER & GLOBAL FILTERS */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Financial FP&A</h1>
            <p className="text-zinc-500 text-sm">Analyze pipeline, cohorts, and customer behavior.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Origin Filter */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border shadow-sm">
              <ShoppingCart size={16} className="text-zinc-400" />
              <select 
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="text-sm font-bold border-none focus:ring-0 bg-transparent outline-none cursor-pointer"
              >
                <option value="all">All Origins</option>
                <option value="woo">WooCommerce Only</option>
                <option value="manual">PM Input Only</option>
                <option value="organic">Organic / Direct</option>
              </select>
            </div>

            {/* Campaign Filter */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border shadow-sm">
              <Filter size={16} className="text-zinc-400" />
              <select 
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="text-sm font-bold border-none focus:ring-0 bg-transparent outline-none cursor-pointer"
              >
                <option value="all">All Channels</option>
                <option disabled>──────────</option>
                {availableCampaigns.map(camp => (
                  <option key={camp} value={camp}>Campaign: {camp}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
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
        <div className="flex flex-wrap items-center gap-2 mb-8 bg-zinc-200/50 p-1 rounded-2xl w-fit">
          <TabButton active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} icon={<Briefcase size={16}/>} label="Closed Jobs" />
          <TabButton active={activeTab === 'quotes'} onClick={() => setActiveTab('quotes')} icon={<Layers size={16}/>} label="Pipeline Quotes" />
          <TabButton active={activeTab === 'cohort'} onClick={() => setActiveTab('cohort')} icon={<Target size={16}/>} label="Cohort ROI" />
          <TabButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={16}/>} label="Customer Analysis" />
          <TabButton active={activeTab === 'mom'} onClick={() => setActiveTab('mom')} icon={<TrendingUp size={16}/>} label="MoM Summary" />
          {/* <TabButton active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')} icon={<Award size={16}/>} label="Leaderboard" /> */}
        </div>

        {/* ACTIVE TAB CONTENT */}
        <div className="animate-in fade-in slide-in-from-bottom-2">
          {activeTab === 'jobs' && <ClosedJobsTab filters={filters} />}
          {activeTab === 'quotes' && <PipelineQuotesTab filters={filters} />}
          {activeTab === 'cohort' && <CohortAnalysisTab filters={filters} />}
          {activeTab === 'customers' && <CustomerAnalysisTab filters={filters} />}
          {activeTab === 'mom' && <MonthOverMonthTab filters={filters} />}
        </div>

      </div>
    </main>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
        active ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
      }`}
    >
      {icon} {label}
    </button>
  );
}