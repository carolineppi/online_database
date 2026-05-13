'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  Users, Search, Mail, Phone, ChevronDown, ChevronUp, 
  Briefcase, Loader2, Plus
} from 'lucide-react';
import CreateSubmittalForm from '@/components/CreateSubmittalForm';
import { toast } from 'sonner';

function formatPhone(phoneRaw: any) {
  if (!phoneRaw) return 'N/A';
  const stringData = String(phoneRaw);
  const cleaned = stringData.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  return stringData;
}

export default function CustomersPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCustomerForSubmittal, setSelectedCustomerForSubmittal] = useState<any>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          id, 
          first_name, 
          last_name, 
          email, 
          phone, 
          created_at,
          quote_submittals (
            id, 
            job_name, 
            quote_number, 
            status, 
            created_at,
            deleted_at, 
            jobs (
              id, 
              sale_amount,
              deleted_at
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedCustomers = (data || []).map(customer => {
        // NEW: Filter out any quote submittals that are in the trash
        const activeQuotes = (customer.quote_submittals || []).filter((q: any) => !q.deleted_at);
        
        let totalSpent = 0;
        let wonJobsCount = 0;

        const sortedQuotes = Array.isArray(activeQuotes) 
          ? [...activeQuotes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          : [];

        sortedQuotes.forEach((q: any) => {
          const jobs = Array.isArray(q.jobs) ? q.jobs : (q.jobs ? [q.jobs] : []);
          
          // NEW: Filter out any jobs that are in the trash
          const activeJobs = jobs.filter((j: any) => !j.deleted_at);
          
          activeJobs.forEach((j: any) => {
            totalSpent += Number(j.sale_amount) || 0;
            wonJobsCount++;
          });
        });

        return {
          ...customer,
          fullName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown Customer',
          quotesCount: sortedQuotes.length, // Now reflects ACTIVE quotes only
          wonJobsCount, // Now reflects ACTIVE jobs only
          totalSpent, // Now reflects ACTIVE spend only
          quotes: sortedQuotes 
        };
      });

      setCustomers(formattedCustomers);
    } catch (err: any) {
      console.error("Error fetching customers:", err);
      toast.error("Failed to load customer directory.");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(term) ||
      (c.email && String(c.email).toLowerCase().includes(term)) ||
      (c.phone && String(c.phone).includes(term)) ||
      c.quotes.some((q: any) => q.job_name?.toLowerCase().includes(term) || q.quote_number?.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto bg-zinc-50 min-h-screen">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 flex items-center gap-3">
            <Users className="text-blue-600" size={32} /> Customer Directory
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Track lifetime value, contact info, and project history.</p>
        </div>

        <div className="w-full md:w-96 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, phone, or job name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
          <Loader2 className="animate-spin" size={32} />
          <p className="font-bold uppercase tracking-widest text-xs">Loading Directory...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Customer Details</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4 text-center">Total Quotes</th>
                  <th className="px-6 py-4 text-center">Won Jobs</th>
                  <th className="px-6 py-4 text-right">Lifetime Spend</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {filteredCustomers.map((customer) => (
                  <React.Fragment key={customer.id}>
                    <tr 
                      onClick={() => toggleExpand(customer.id)}
                      className={`transition cursor-pointer ${expandedId === customer.id ? 'bg-blue-50/30' : 'hover:bg-zinc-50'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-black text-zinc-900 text-base">{customer.fullName}</div>
                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
                          Added {new Date(customer.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[220px]">
                        <div className="flex flex-col gap-1.5">
                          <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-zinc-600 hover:text-blue-600 transition font-medium">
                            <Mail size={14} className="text-zinc-400 shrink-0" /> 
                            <span className="truncate" title={customer.email}>{customer.email || 'No Email'}</span>
                          </a>
                          <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-zinc-600 hover:text-blue-600 transition font-medium">
                            <Phone size={14} className="text-zinc-400 shrink-0" /> 
                            <span className="truncate">{formatPhone(customer.phone)}</span>
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center bg-zinc-100 text-zinc-700 font-bold rounded-lg px-3 py-1">
                          {customer.quotesCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold rounded-lg px-3 py-1">
                          {customer.wonJobsCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-mono font-black text-emerald-600 text-lg">
                          ${customer.totalSpent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomerForSubmittal(customer);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition"
                          title="Start New Quote for Customer"
                        >
                          <Plus size={20} />
                        </button>
                        
                        <button className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition">
                          {expandedId === customer.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </td>
                    </tr>

                    {expandedId === customer.id && (
                      <tr>
                        <td colSpan={6} className="px-0 py-0 bg-zinc-50 border-b border-zinc-200">
                          <div className="px-8 py-6 shadow-inner">
                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Briefcase size={14} /> Project History
                            </h4>
                            
                            {customer.quotes.length === 0 ? (
                              <p className="text-sm text-zinc-500 italic">No quotes found for this customer.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {customer.quotes.map((quote: any) => {
                                  const isWon = quote.status === 'WON';
                                  
                                  const jobObj = Array.isArray(quote.jobs) ? quote.jobs[0] : quote.jobs;
                                  const jobAmount = jobObj ? Number(jobObj.sale_amount) : 0;

                                  return (
                                    <a 
                                      key={quote.id} 
                                      href={`/submittals/${quote.id}`}
                                      target="_blank"
                                      className="block bg-white p-4 rounded-2xl border border-zinc-200 hover:border-blue-300 hover:shadow-md transition group relative overflow-hidden"
                                    >
                                      <div className={`absolute top-0 left-0 w-1 h-full ${isWon ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                      
                                      <div className="pl-2">
                                        <div className="flex justify-between items-start mb-2">
                                          <h5 className="font-bold text-zinc-900 truncate pr-2 group-hover:text-blue-600 transition" title={quote.job_name}>
                                            {quote.job_name || 'Untitled Project'}
                                          </h5>
                                          <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
                                            #{quote.quote_number}
                                          </span>
                                        </div>
                                        
                                        <div className="flex items-end justify-between mt-4">
                                          <div>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                                              isWon ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                            }`}>
                                              {quote.status}
                                            </span>
                                            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-2">
                                              {new Date(quote.created_at).toLocaleDateString()}
                                            </div>
                                          </div>
                                          
                                          {isWon && jobAmount > 0 && (
                                            <div className="text-right">
                                              <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Sold For</p>
                                              <p className="font-mono font-black text-emerald-600">
                                                ${jobAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-medium">
                      No customers found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {selectedCustomerForSubmittal && (
        <CreateSubmittalForm 
          initialCustomer={selectedCustomerForSubmittal} 
          onClose={() => setSelectedCustomerForSubmittal(null)} 
        />
      )}
    </div>
  );
}