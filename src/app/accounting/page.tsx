'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { hasAccess, normalizeRoles } from '@/utils/rbac';
import { DollarSign, Loader2, Calendar, Download, Search } from 'lucide-react';
import { toast } from 'sonner';

interface LedgerRow {
  quoteId: string;
  submittalId: string;
  jobId: string; 
  poNumber: string;
  maskNumber: string; // <-- Added Mask Number
  customerName: string;
  saleAmount: number;
  estimatedCost: number;
  actualCost: number;
  originalActualCost: number;
  manufacturer: string;
}

export default function AccountingPage() {
  const router = useRouter();
  const supabase = createClient();

  // Role Auth State
  const [authorized, setAuthorized] = useState(false);
  
  // Data State
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(''); // <-- Added Search State

  // Date Filter State (Defaults to 1st of current month -> Today)
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  // --- 1. BOUNCER EFFECT ---
  useEffect(() => {
    const saved = localStorage.getItem('employee');
    if (!saved) {
      window.location.href = '/login';
      return;
    }

    const employee = JSON.parse(saved);
    const roles = normalizeRoles(employee.roles);

    if (!hasAccess(roles, ['Accounting', 'Admin'])) {
      router.replace('/submittals'); 
    } else {
      setAuthorized(true);
    }
  }, [router]);

  // --- 2. DATA FETCHING ---
  const fetchLedger = async () => {
    setLoading(true);
    try {
      const endOfDay = new Date(endDate);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .gte('created_at', new Date(startDate).toISOString())
        .lt('created_at', endOfDay.toISOString());

      if (jobsError) throw jobsError;
      if (!jobs || jobs.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const submittalIds = jobs.map(j => j.quote_id);
      const allWinningQuoteIds = jobs.flatMap(j => j.winning_quote_ids || (j.accepted_individual_quote ? [j.accepted_individual_quote] : []));

      if (allWinningQuoteIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: submittals, error: subError } = await supabase
        .from('quote_submittals')
        .select('*, linked_customer:customers!customer(first_name, last_name)')
        .in('id', submittalIds);

      if (subError) throw subError;

      const { data: quotes, error: quoteError } = await supabase
        .from('individual_quotes')
        .select('id, quote_id, price, estimated_cost, actual_cost, manufacturer')
        .in('id', allWinningQuoteIds);

      if (quoteError) throw quoteError;

      const assembledRows: LedgerRow[] = [];

      jobs.forEach(job => {
        const jobSubmittal = submittals?.find(s => s.id === job.quote_id);
        if (!jobSubmittal) return;

        const jobWinningIds = job.winning_quote_ids || (job.accepted_individual_quote ? [job.accepted_individual_quote] : []);
        const jobQuotes = quotes?.filter(q => jobWinningIds.includes(q.id)) || [];

        const customer = jobSubmittal.linked_customer;
        const customerName = customer 
          ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown Customer'
          : 'Unknown Customer';

        const mfgCounts: Record<string, number> = {};

        jobQuotes.forEach(quote => {
          let poNumber = jobSubmittal.quote_number;

          if (jobQuotes.length > 1) {
            const mfgPrefix = (quote.manufacturer || 'UNK').substring(0, 3).toUpperCase();
            mfgCounts[mfgPrefix] = (mfgCounts[mfgPrefix] || 0) + 1;
            
            const suffix = mfgCounts[mfgPrefix] > 1 ? mfgCounts[mfgPrefix].toString() : '';
            poNumber = `${jobSubmittal.quote_number}-${mfgPrefix}${suffix}`;
          }

          assembledRows.push({
            quoteId: quote.id,
            submittalId: jobSubmittal.id,
            jobId: job.id, 
            poNumber,
            maskNumber: jobSubmittal.quote_number_mask || '', // <-- Added Mask Number mapping
            customerName,
            saleAmount: Number(quote.price) || 0,
            
            // FIX: Exclusively pull the individual quote's estimated cost
            estimatedCost: Number(quote.estimated_cost) || 0,
            
            actualCost: Number(job.actual_cost) || 0,
            originalActualCost: Number(job.actual_cost) || 0, 
            manufacturer: quote.manufacturer || 'Unknown'
          });
        });
      });

      setRows(assembledRows);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) fetchLedger();
  }, [authorized, startDate, endDate]);

  // --- 3. INLINE EDITING LOGIC ---
  const handleActualCostChange = (quoteId: string, value: string) => {
    setRows(prev => prev.map(row => 
      row.quoteId === quoteId ? { ...row, actualCost: Number(value) || 0 } : row
    ));
  };

  const handleActualCostBlur = async (quoteId: string, jobId: string, newCost: number, originalCost: number) => {
    if (newCost === originalCost) return; 

    setSavingId(quoteId);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ actual_cost: newCost })
        .eq('id', jobId); 

      if (error) throw error;
      toast.success('Cost updated!');

      setRows(prev => prev.map(row => 
        row.quoteId === quoteId ? { ...row, originalActualCost: newCost } : row
      ));
    } catch (err: any) {
      toast.error('Error saving cost');
      setRows(prev => prev.map(row => 
        row.quoteId === quoteId ? { ...row, actualCost: originalCost } : row
      ));
    } finally {
      setSavingId(null);
    }
  };

  // --- 4. CSV EXPORT LOGIC ---
  const handleExportCSV = () => {
    if (filteredRows.length === 0) {
      toast.error('No data to export.');
      return;
    }

    const headers = ['PO Number', 'Mask Number', 'Customer Name', 'Sale Amount', 'Estimated Cost', 'Actual Cost', 'Markup'];
    
    const csvData = filteredRows.map(row => {
      let markupString = 'N/A';
      if (row.actualCost > 0) {
        const markupNum = ((row.saleAmount - row.actualCost) / row.actualCost) * 100;
        markupString = `${markupNum.toFixed(1)}%`;
      } else if (row.saleAmount > 0 && row.actualCost === 0) {
        markupString = '100.0%';
      }

      return [
        `"${row.poNumber}"`,
        `"${row.maskNumber}"`,
        `"${row.customerName.replace(/"/g, '""')}"`,
        row.saleAmount,
        row.estimatedCost,
        row.actualCost,
        `"${markupString}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvData].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Accounting_Ledger_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  // Filter rows based on search query
  const filteredRows = rows.filter(row => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      row.poNumber.toLowerCase().includes(query) ||
      row.customerName.toLowerCase().includes(query) ||
      (row.maskNumber && row.maskNumber.toLowerCase().includes(query))
    );
  });

return (
    <main className="pl-64 min-h-screen bg-gray-50">
      <div className="p-8 lg:p-12 max-w-[1600px] mx-auto">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
            <DollarSign size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">Accounting Ledger</h1>
            <p className="text-zinc-500 font-medium mt-1">Review finalized jobs and input actual vendor costs.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          
          {/* NEW: Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Search PO, mask, or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-medium shadow-sm w-[260px]"
            />
          </div>

          <div className="flex items-center bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 border-r border-zinc-100">
              <Calendar size={18} className="text-zinc-400" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm font-bold text-zinc-700 outline-none bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2 px-3">
              <span className="text-zinc-400 text-sm font-bold">to</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm font-bold text-zinc-700 outline-none bg-transparent"
              />
            </div>
          </div>
          
          <button 
            onClick={handleExportCSV}
            disabled={loading || filteredRows.length === 0}
            className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-emerald-600 transition disabled:opacity-50"
            title="Export to CSV"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-500 font-black uppercase tracking-widest text-[10px]">
                <th className="p-5 pl-6">PO Number</th>
                <th className="p-5">Customer</th>
                <th className="p-5 text-right">Sale Amount</th>
                <th className="p-5 text-right">Est. Cost</th>
                <th className="p-5 text-right w-48">Actual Cost</th>
                <th className="p-5 text-right pr-6">Markup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <Loader2 className="animate-spin text-zinc-400 mx-auto" size={24} />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-3">Loading Ledger...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No completed jobs found in this date range.</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No results match your search.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  let markupString = 'N/A';
                  let markupColor = 'bg-zinc-100 text-zinc-400'; // Default gray for uncalculated/missing

                  if (row.actualCost > 0) {
                    const markupNum = ((row.saleAmount - row.actualCost) / row.actualCost) * 100;
                    markupString = `${markupNum.toFixed(1)}%`;

                    if (markupNum < 0) {
                      // Loss (Negative) -> Red
                      markupColor = 'bg-red-100 text-red-700';
                    } else if (markupNum > 0) {
                      // Profit (Positive) -> Green
                      markupColor = 'bg-emerald-100 text-emerald-700';
                    } else {
                      // Exactly 0% Breakeven -> Neutral
                      markupColor = 'bg-zinc-100 text-zinc-600';
                    }
                  } else if (row.saleAmount > 0 && row.actualCost === 0) {
                    // Not inputted yet
                    markupString = '100.0%';
                    markupColor = 'bg-zinc-100 text-zinc-400';
                  }

                  return (
                    <tr key={row.quoteId} className="hover:bg-blue-50/30 transition group">
                      
                      {/* Subtly display Mask Number next to PO Number */}
                      <td className="p-5 pl-6">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 bg-zinc-100 px-3 py-1.5 rounded-lg">{row.poNumber}</span>
                          {row.maskNumber && (
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">#{row.maskNumber}</span>
                          )}
                        </div>
                      </td>
                      
                      <td className="p-5 font-bold text-zinc-700">{row.customerName}</td>
                      <td className="p-5 text-right font-black text-emerald-600">
                        ${row.saleAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-5 text-right font-bold text-zinc-400">
                        ${row.estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      
                      {/* Interactive Actual Cost Cell */}
                      <td className="p-3 text-right relative w-48">
                        <div className="relative flex items-center justify-end">
                          <span className="absolute left-4 text-zinc-400 font-bold">$</span>
                          <input 
                            type="number"
                            step="0.01"
                            value={row.actualCost || ''}
                            onChange={(e) => handleActualCostChange(row.quoteId, e.target.value)}
                            onBlur={(e) => handleActualCostBlur(row.quoteId, row.jobId, Number(e.target.value) || 0, row.originalActualCost)}
                            className={`w-full text-right py-2.5 pr-4 pl-8 rounded-xl font-black outline-none transition-all ${
                              row.actualCost === 0 
                                ? 'bg-amber-50 text-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-400' 
                                : 'bg-transparent text-zinc-900 focus:bg-white focus:ring-2 focus:ring-blue-500 hover:bg-white group-hover:bg-white'
                            }`}
                            placeholder="0.00"
                          />
                          {savingId === row.quoteId && (
                            <Loader2 size={14} className="animate-spin text-blue-500 absolute right-4" />
                          )}
                        </div>
                      </td>

                      <td className="p-5 text-right pr-6">
                        <span className={`font-black text-xs px-2.5 py-1 rounded-md ${markupColor}`}>
                          {markupString}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
    </main>
  );
}