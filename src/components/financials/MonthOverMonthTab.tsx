'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  TrendingUp, TrendingDown, Minus, DollarSign, Target, Briefcase, FileText, Percent, Loader2, Calendar, ArrowRight
} from 'lucide-react';

export default function MonthOverMonthTab({ filters }: { filters: any }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // Calculate the default previous period to use as an initial state
  const defaultPrev = useMemo(() => {
    // Feed the exact Eastern Time boundaries into the JS Date objects
    const currentStart = new Date(filters.exactStart);
    const currentEnd = new Date(filters.exactEnd);
    const diffTime = currentEnd.getTime() - currentStart.getTime();
    
    const prevEnd = new Date(currentStart.getTime() - 1); 
    const prevStart = new Date(prevEnd.getTime() - diffTime);
    return {
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    };
  }, [filters.exactStart, filters.exactEnd]);

  // Secondary date state specifically for the comparison period
  const [compareRange, setCompareRange] = useState(defaultPrev);

  // Auto-sync the comparison range if the user changes the global date range
  useEffect(() => {
    setCompareRange(defaultPrev);
  }, [defaultPrev]);

  const [metrics, setMetrics] = useState({
    current: { quotes: 0, jobs: 0, winRate: 0, revenue: 0, cost: 0, profit: 0, margin: 0, avgDeal: 0 },
    previous: { quotes: 0, jobs: 0, winRate: 0, revenue: 0, cost: 0, profit: 0, margin: 0, avgDeal: 0 },
    periodLabels: { current: '', previous: '' }
  });


  useEffect(() => {
    const getEasternISO = (dateString: string, isEnd: boolean) => {
      if (!dateString) return '';
      const time = isEnd ? '23:59:59.999' : '00:00:00.000';
      // Use Noon UTC to safely determine if this specific day is EST or EDT
      const d = new Date(`${dateString}T12:00:00Z`);
      const tzString = d.toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" });
      const offset = tzString.includes("EDT") ? "-04:00" : "-05:00";
      return `${dateString}T${time}${offset}`;
    };

    const fetchMoMData = async () => {
      setLoading(true);
      try {
        // Feed the exact Eastern Time boundaries into the JS Date objects
        const currentStart = new Date(filters.exactStart);
        const currentEnd = new Date(filters.exactEnd);
        
        // Use our helper to lock the comparison date range to Eastern time as well
        const prevStart = new Date(getEasternISO(compareRange.start, false));
        const prevEnd = new Date(getEasternISO(compareRange.end, true));

        const labels = {
          current: `${currentStart.toLocaleDateString()} - ${currentEnd.toLocaleDateString()}`,
          previous: `${prevStart.toLocaleDateString()} - ${prevEnd.toLocaleDateString()}`
        };

        // To fetch efficiently, grab the widest possible envelope that covers BOTH date ranges
        const minStart = currentStart < prevStart ? currentStart : prevStart;
        const maxEnd = currentEnd > prevEnd ? currentEnd : prevEnd;

        const [quotesRes, jobsRes, campaignRes] = await Promise.all([
          supabase.from('quote_submittals')
            .select('id, source, quote_source, created_at')
            .gte('created_at', filters.exactStart)
            .lte('created_at', filters.exactEnd)
            .is('deleted_at', null),
          
          supabase.from('jobs')
            .select('id, sale_amount, actual_cost, created_at, quote_submittals(source, quote_source, add_ons(price, deleted_at))')
            .gte('created_at', filters.exactStart)
            .lte('created_at', filters.exactEnd)
            .is('deleted_at', null),

          supabase.from('campaign_sources').select('*')
        ]);

        const rawQuotes = (quotesRes.data as any[]) || [];
        const rawJobs = (jobsRes.data as any[]) || [];
        const campaignMap = new Map(campaignRes.data?.map(c => [c.campaign_id, c.campaign_name]) || []);

        const processPeriod = (start: Date, end: Date) => {
          const periodQuotes = rawQuotes.filter((q: any) => {
            const qDate = new Date(q.created_at).getTime();
            if (qDate < start.getTime() || qDate > end.getTime()) return false;

            const isWoo = q.source === 'WooCommerce';
            const isManual = q.quote_source === 'PM Input';
            const isOrganic = q.quote_source === 'Organic / Direct';
            const isPaid = /^\d+$/.test(q.quote_source || ''); 
            
            const displayCampaign = isPaid ? (campaignMap.get(q.quote_source) || q.quote_source) : '';

            if (filters.originFilter === 'woo' && !isWoo) return false;
            if (filters.originFilter === 'manual' && !isManual) return false;
            if (filters.originFilter === 'organic' && !isOrganic) return false;
            if (filters.campaignFilter !== 'all' && displayCampaign !== filters.campaignFilter) return false;

            return true;
          });

          const periodJobs = rawJobs.filter((job: any) => {
            const jDate = new Date(job.created_at).getTime();
            if (jDate < start.getTime() || jDate > end.getTime()) return false;
            
            const sub = job.quote_submittals;
            if (!sub) return false;

            const isWoo = sub.source === 'WooCommerce';
            const isManual = sub.quote_source === 'PM Input';
            const isOrganic = sub.quote_source === 'Organic / Direct';
            const isPaid = /^\d+$/.test(sub.quote_source || ''); 

            const displayCampaign = isPaid ? (campaignMap.get(sub.quote_source) || sub.quote_source) : '';

            if (filters.originFilter === 'woo' && !isWoo) return false;
            if (filters.originFilter === 'manual' && !isManual) return false;
            if (filters.originFilter === 'organic' && !isOrganic) return false;
            if (filters.campaignFilter !== 'all' && displayCampaign !== filters.campaignFilter) return false;

            return true;
          });

          let revenue = 0;
          let cost = 0;

          periodJobs.forEach((job: any) => {
            const addonsSum = job.quote_submittals?.add_ons?.filter((a: any) => !a.deleted_at).reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0) || 0;
            revenue += (Number(job.sale_amount) || 0) + addonsSum;
            cost += (Number(job.actual_cost) || 0);
          });

          const profit = revenue - cost;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
          const winRate = periodQuotes.length > 0 ? (periodJobs.length / periodQuotes.length) * 100 : 0;
          const avgDeal = periodJobs.length > 0 ? revenue / periodJobs.length : 0;

          return { quotes: periodQuotes.length, jobs: periodJobs.length, winRate, revenue, cost, profit, margin, avgDeal };
        };

        setMetrics({
          current: processPeriod(currentStart, currentEnd),
          previous: processPeriod(prevStart, prevEnd),
          periodLabels: labels
        });

      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchMoMData();
  }, [filters, compareRange, supabase]);

  if (loading) return <div className="flex justify-center p-12 text-zinc-400"><Loader2 className="animate-spin" size={32} /></div>;

  return (
    <div>
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 px-2 gap-4">
        <div>
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Executive Comparison</h3>
          <p className="text-sm font-medium text-zinc-500 mt-1">
            Comparing <span className="font-bold text-zinc-800">{metrics.periodLabels.current}</span> vs <span className="font-bold text-zinc-800">{metrics.periodLabels.previous}</span>
          </p>
        </div>

        {/* SECONDARY DATE SELECTOR */}
        <div className="flex items-center gap-3 bg-zinc-100 p-1.5 rounded-3xl border shadow-inner">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-3">Compare To:</span>
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border shadow-sm">
            <Calendar size={18} className="text-zinc-400 ml-2" />
            <input 
              type="date" 
              value={compareRange.start}
              onChange={(e) => setCompareRange({...compareRange, start: e.target.value})}
              className="text-sm font-medium border-none focus:ring-0 p-1 outline-none cursor-pointer"
            />
            <ArrowRight size={14} className="text-zinc-300" />
            <input 
              type="date" 
              value={compareRange.end}
              onChange={(e) => setCompareRange({...compareRange, end: e.target.value})}
              className="text-sm font-medium border-none focus:ring-0 p-1 outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <ComparisonCard 
          title="Gross Revenue" 
          current={metrics.current.revenue} 
          previous={metrics.previous.revenue} 
          icon={<DollarSign className="text-emerald-600"/>} 
          color="emerald" 
          isCurrency 
        />
        <ComparisonCard 
          title="Gross Profit" 
          current={metrics.current.profit} 
          previous={metrics.previous.profit} 
          icon={<TrendingUp className="text-blue-600"/>} 
          color="blue" 
          isCurrency 
        />
        <ComparisonCard 
          title="Gross Margin" 
          current={metrics.current.margin} 
          previous={metrics.previous.margin} 
          icon={<Percent className="text-purple-600"/>} 
          color="purple" 
          isPercentage 
          isAbsoluteDiff 
        />
        <ComparisonCard 
          title="Cost of Goods" 
          current={metrics.current.cost} 
          previous={metrics.previous.cost} 
          icon={<DollarSign className="text-amber-600"/>} 
          color="amber" 
          isCurrency 
          reverseColors 
        />
        
        <ComparisonCard 
          title="Quotes Created" 
          current={metrics.current.quotes} 
          previous={metrics.previous.quotes} 
          icon={<FileText className="text-zinc-600"/>} 
          color="zinc" 
        />
        <ComparisonCard 
          title="Closed Deals" 
          current={metrics.current.jobs} 
          previous={metrics.previous.jobs} 
          icon={<Briefcase className="text-emerald-600"/>} 
          color="emerald" 
        />
        <ComparisonCard 
          title="Win Rate" 
          current={metrics.current.winRate} 
          previous={metrics.previous.winRate} 
          icon={<Target className="text-blue-600"/>} 
          color="blue" 
          isPercentage
          isAbsoluteDiff
        />
        <ComparisonCard 
          title="Avg Deal Size" 
          current={metrics.current.avgDeal} 
          previous={metrics.previous.avgDeal} 
          icon={<DollarSign className="text-purple-600"/>} 
          color="purple" 
          isCurrency 
        />
      </div>
    </div>
  );
}

function ComparisonCard({ title, current, previous, icon, color, isCurrency = false, isPercentage = false, isAbsoluteDiff = false, reverseColors = false }: any) {
  let diff = 0;
  let formattedDiff = "";
  
  if (isAbsoluteDiff) {
    diff = current - previous;
    formattedDiff = `${Math.abs(diff).toFixed(1)}%`;
  } else {
    if (previous === 0) {
      diff = current > 0 ? 100 : 0;
    } else {
      diff = ((current - previous) / previous) * 100;
    }
    formattedDiff = `${Math.abs(diff).toFixed(1)}%`;
  }

  let displayValue = current.toLocaleString(undefined, { maximumFractionDigits: isPercentage ? 1 : 0 });
  if (isCurrency) displayValue = `$${displayValue}`;
  if (isPercentage) displayValue = `${displayValue}%`;

  let prevDisplayValue = previous.toLocaleString(undefined, { maximumFractionDigits: isPercentage ? 1 : 0 });
  if (isCurrency) prevDisplayValue = `$${prevDisplayValue}`;
  if (isPercentage) prevDisplayValue = `${prevDisplayValue}%`;

  const isPositive = diff > 0;
  const isNeutral = diff === 0;
  
  let indicatorColor = "text-zinc-500 bg-zinc-100";
  let IndicatorIcon = Minus;

  if (!isNeutral) {
    if ((isPositive && !reverseColors) || (!isPositive && reverseColors)) {
      indicatorColor = "text-emerald-700 bg-emerald-100";
      IndicatorIcon = isPositive ? TrendingUp : TrendingDown;
    } else {
      indicatorColor = "text-red-700 bg-red-100";
      IndicatorIcon = isPositive ? TrendingUp : TrendingDown;
    }
  }

  const bgColors: any = {
    blue: "bg-blue-50 border-blue-100", emerald: "bg-emerald-50 border-emerald-100",
    purple: "bg-purple-50 border-purple-100", amber: "bg-amber-50 border-amber-100",
    zinc: "bg-white border-zinc-200"
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${bgColors[color]}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest ${indicatorColor}`}>
          <IndicatorIcon size={12} strokeWidth={3} />
          {isNeutral ? 'FLAT' : formattedDiff}
        </div>
      </div>
      
      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{title}</p>
      <h3 className="text-3xl font-black text-zinc-900 mt-1">{displayValue}</h3>
      
      <p className="text-[10px] font-bold text-zinc-400 mt-3 tracking-widest uppercase">
        Prev: <span className="text-zinc-600">{prevDisplayValue}</span>
      </p>
    </div>
  );
}