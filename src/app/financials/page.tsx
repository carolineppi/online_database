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
  
  // Default date range: current month
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
    
    // 1. Fetch ALL submittals in range (for Quote Volume)
    const { data: allSubmittals } = await supabase
      .from('quote_submittals')
      .select('id, created_at, status')
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);

    // 2. Fetch WON submittals with their individual quote prices
    const { data: wonData } = await supabase
      .from('quote_submittals')
      .select(`
        id, 
        job_name, 
        quote_number, 
        created_at,
        individual_quotes (price)
      `)
      .eq('status', 'Won')
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`);

    const quotesCount = allSubmittals?.length || 0;
    const winsCount = wonData?.length || 0;
    
    // Calculate Total Revenue from won jobs
    const revenue = wonData?.reduce((acc, job) => {
      const jobTotal = job.individual_quotes?.reduce((sum: number, opt: any) => sum + (Number(opt.price) || 0), 0) || 0;
      return acc + jobTotal;
    }, 0) || 0;

    setStats({
      totalQuotes: quotesCount,
      wonJobs: winsCount,
      totalRevenue: revenue,
      conversionRate: quotesCount > 0 ? (winsCount / quotesCount) * 100 : 0,
      jobList: wonData || []
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
          <p className="text-zinc-500 text-sm">Track quote volume and revenue conversion.</p>
        </div>

        {/* Date Filter */}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Quotes" value={stats.totalQuotes} icon={<FileText className="text-blue-600" />} color="blue" />
        <StatCard title="Jobs Won" value={stats.wonJobs} icon={<CheckCircle className="text-emerald-600" />} color="emerald" />
        <StatCard title="Conversion" value={`${stats.conversionRate.toFixed(1)}%`} icon={<TrendingUp className="text-purple-600" />} color="purple" />
        <StatCard title="Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} icon={<DollarSign className="text-amber-600" />} color="amber" />
      </div>

      {/* Won Jobs Table */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-white">
          <h2 className="font-bold text-lg">Won Jobs Breakdown</h2>
          <p className="text-xs text-zinc-400">Individual jobs secured within this date range.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Job Name</th>
                <th className="px-6 py-4">Quote #</th>
                <th className="px-6 py-4">Date Won</th>
                <th className="px-6 py-4 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {stats.jobList.map((job) => (
                <tr key={job.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-900">{job.job_name}</td>
                  <td className="px-6 py-4 text-zinc-500">#{job.quote_number}</td>
                  <td className="px-6 py-4 text-zinc-500">{new Date(job.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                    ${job.individual_quotes?.reduce((sum: number, opt: any) => sum + (Number(opt.price) || 0), 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {stats.jobList.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 italic">No won jobs found in this range.</td>
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
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
      </div>
      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black text-zinc-900 mt-1">{value}</h3>
    </div>
  );
}