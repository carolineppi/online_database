'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Search, Briefcase, FileText, User, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSearch = searchTerm.trim();
    if (!cleanSearch) return;

    setLoading(true);

  // Inside handleSearch in src/app/customers/page.tsx
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      quote_submittals (
        *,
        jobs:jobs!fk_jobs_to_submittals (*) 
      )
    `)
    .or(`first_name.ilike.%${cleanSearch}%,last_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`)
    .limit(10);

    if (error) {
      console.error("Search Error:", error.message);
    } else {
      console.log("SEARCH DATA:", data);
      setResults(data || []);
      setSelectedCustomer(null); // Clear active customer when performing a new search
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-zinc-900 mb-4">Customer Directory</h1>
        <p className="text-zinc-500">Search and manage customer job histories.</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
        <input 
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-12 pr-24 py-4 text-lg border-2 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-sm"
        />
        <button type="submit" disabled={loading} className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* No Results Flicker Fix */}
      {!loading && searchTerm && results.length === 0 && (
        <div className="text-center p-12 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
          <p className="text-zinc-500 font-medium">No customers found matching "{searchTerm}"</p>
        </div>
      )}

      {/* STEP 2: SEARCH RESULTS LISTING */}
      {!selectedCustomer && results.length > 0 && (
        <div className="grid gap-3 mb-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Found Matches</p>
          {results.map(customer => (
            <button 
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
              className="flex items-center justify-between p-5 bg-white border border-zinc-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition">
                  <User size={24} />
                </div>
                <div>
                  <p className="font-bold text-zinc-900 text-lg">{customer.first_name} {customer.last_name}</p>
                  <p className="text-sm text-zinc-500">{customer.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                View History <ChevronRight size={16} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detailed View */}
      {selectedCustomer && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-end mb-8 border-b pb-6">
            <div>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-800 uppercase tracking-widest flex items-center gap-1 mb-4 transition"
              >
                <X size={14} /> Back to Search Results
              </button>
              <h2 className="text-3xl font-black text-zinc-900">
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </h2>
              <p className="text-zinc-500 font-medium">{selectedCustomer.email} • {selectedCustomer.phone}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* ACTIVE SUBMITTALS (No job record) */}
            <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-5 border-b bg-blue-50/30">
                <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={16} /> Active Submittals
                </h3>
              </div>
              <div className="p-5 space-y-3">
                {selectedCustomer.quote_submittals?.filter((s: any) => !s.jobs || s.jobs.length === 0).map((s: any) => (
                  <div key={s.id} className="p-4 border border-zinc-100 rounded-2xl flex justify-between items-center hover:bg-zinc-50 transition group">
                    <div>
                      <p className="text-sm font-bold text-zinc-800">{s.job_name}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">#{s.quote_number} • {s.status}</p>
                    </div>
                    <Link href={`/submittals/${s.id}`} className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition">
                      Details
                    </Link>
                  </div>
                ))}
                {selectedCustomer.quote_submittals?.filter((s: any) => !s.jobs || s.jobs.length === 0).length === 0 && (
                  <p className="text-sm text-zinc-400 italic text-center py-4">No active submittals found.</p>
                )}
              </div>
            </div>

            {/* COMPLETED JOBS (Has job record) */}
            <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-5 border-b bg-emerald-50/30">
                <h3 className="text-xs font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2">
                  <Briefcase size={16} /> Completed Jobs
                </h3>
              </div>
              <div className="p-5 space-y-3">
                {selectedCustomer.quote_submittals?.filter((s: any) => s.jobs && s.jobs.length > 0).map((s: any) => (
                  <div key={s.id} className="p-4 border border-emerald-100 bg-emerald-50/10 rounded-2xl flex justify-between items-center group">
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{s.job_name}</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">
                        Sold for ${Number(s.jobs[0].sale_amount).toLocaleString()}
                      </p>
                    </div>
                    <Link href={`/submittals/${s.id}`} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 transition">
                      View
                    </Link>
                  </div>
                ))}
                {selectedCustomer.quote_submittals?.filter((s: any) => s.jobs && s.jobs.length > 0).length === 0 && (
                  <p className="text-sm text-zinc-400 italic text-center py-4">No completed jobs found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}