'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Users, UserPlus, UserCheck, Loader2 } from 'lucide-react';

export default function CustomerAnalysisTab({ filters }: { filters: any }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    newCustomers: 0,
    repeatCustomers: 0,
    newRevenue: 0,
    repeatRevenue: 0,
    customerList: [] as any[]
  });

  useEffect(() => {
    const fetchCustomerData = async () => {
      setLoading(true);
      try {
        const { data: quotes } = await supabase
          .from('quote_submittals')
          .select('id, customer, created_at')
          .gte('created_at', filters.exactStart)
          .lte('created_at', filters.exactEnd)
          .is('deleted_at', null);

        if (!quotes) return;

        const quoteIds = quotes.map(q => q.id);
        let jobsData: any[] = [];
        let addonsData: any[] = [];

        // Fetch associated financial data for accurate revenue calculation
        if (quoteIds.length > 0) {
          const [jRes, aRes] = await Promise.all([
            supabase.from('jobs').select('quote_id, sale_amount').in('quote_id', quoteIds).is('deleted_at', null),
            supabase.from('add_ons').select('quote_id, price').in('quote_id', quoteIds).is('deleted_at', null)
          ]);
          jobsData = jRes.data || [];
          addonsData = aRes.data || [];
        }

        const periodActivity = new Map();
        
        quotes.forEach(q => {
          if (!q.customer) return;

          // Connect the independent jobs data
          const job = jobsData.find(j => j.quote_id === q.id);
          const addonsSum = addonsData.filter(a => a.quote_id === q.id).reduce((sum, a) => sum + (Number(a.price) || 0), 0);
          const revenue = job ? (Number(job.sale_amount) || 0) + addonsSum : 0;
          
          if (periodActivity.has(q.customer)) {
            const current = periodActivity.get(q.customer);
            current.quoteCount += 1;
            current.revenue += revenue;
          } else {
            periodActivity.set(q.customer, { id: q.customer, quoteCount: 1, revenue: revenue, isRepeat: false });
          }
        });

        const customerIds = Array.from(periodActivity.keys());

        if (customerIds.length > 0) {
          const { data: historicalQuotes } = await supabase
            .from('quote_submittals')
            .select('customer')
            .in('customer', customerIds)
            .lt('created_at', `${filters.dateRange.start}T00:00:00`);

          const repeatIds = new Set(historicalQuotes?.map(h => h.customer) || []);

          const { data: customerDetails } = await supabase
            .from('customers')
            .select('id, first_name, last_name, email')
            .in('id', customerIds);

          const detailsMap = new Map(customerDetails?.map(c => [c.id, c]) || []);

          let newCust = 0, repeatCust = 0, newRev = 0, repeatRev = 0;
          const finalData: any[] = [];

          periodActivity.forEach((data, id) => {
            data.isRepeat = repeatIds.has(id);
            data.details = detailsMap.get(id) || {};
            
            if (data.isRepeat) {
              repeatCust++;
              repeatRev += data.revenue;
            } else {
              newCust++;
              newRev += data.revenue;
            }
            finalData.push(data);
          });

          finalData.sort((a, b) => b.revenue - a.revenue);

          setMetrics({
            newCustomers: newCust,
            repeatCustomers: repeatCust,
            newRevenue: newRev,
            repeatRevenue: repeatRev,
            customerList: finalData
          });
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchCustomerData();
  }, [filters, supabase]);

  if (loading) return <div className="flex justify-center p-12 text-zinc-400"><Loader2 className="animate-spin" size={32} /></div>;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-6 rounded-3xl border shadow-sm bg-blue-50 border-blue-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
              <UserPlus size={16} /> New Customers
            </div>
            <h3 className="text-3xl font-black text-zinc-900">{metrics.newCustomers}</h3>
            <p className="text-sm font-bold text-zinc-500 mt-1">${metrics.newRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})} in closed revenue</p>
          </div>
        </div>
        
        <div className="p-6 rounded-3xl border shadow-sm bg-emerald-50 border-emerald-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
              <UserCheck size={16} /> Repeat Customers
            </div>
            <h3 className="text-3xl font-black text-zinc-900">{metrics.repeatCustomers}</h3>
            <p className="text-sm font-bold text-zinc-500 mt-1">${metrics.repeatRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})} in closed revenue</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-white">
          <h2 className="font-bold text-lg text-zinc-900">Customer Activity Ledger</h2>
          <p className="text-xs text-zinc-400">All customers who interacted during this date range.</p>
        </div>
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">Quotes in Period</th>
              <th className="px-6 py-4 text-right">Closed Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {metrics.customerList.map((cust) => (
              <tr key={cust.id} className="hover:bg-zinc-50/50 transition">
                <td className="px-6 py-4">
                  <div className="font-bold text-zinc-900">{cust.details.first_name} {cust.details.last_name}</div>
                  <div className="text-xs text-zinc-500">{cust.details.email}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${cust.isRepeat ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {cust.isRepeat ? 'Repeat' : 'New'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center font-bold text-zinc-700">{cust.quoteCount}</td>
                <td className="px-6 py-4 text-right font-mono font-black text-zinc-900">
                  ${cust.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}