'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Search, Briefcase, FileText, User, X } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setSelectedCustomer(null);

    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        quote_submittals (
          *,
          jobs (*)
        )
      `)
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .limit(10);

    if (data) setResults(data);
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-zinc-900 mb-4">Customer Directory</h1>
        <p className="text-zinc-500">Search by name or email to view submittals and job history.</p>
      </div>

      {/* SEARCH BAR */}
      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
        <input 
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search customers..."
          className="w-full pl-12 pr-24 py-4 text-lg border-2 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-sm"
        />
        <button 
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* SEARCH RESULTS */}
      {!selectedCustomer && results.length > 0 && (
        <div className="grid gap-3 mb-12">
          <p className="text-xs font-bold text-zinc-400 uppercase ml-2">Search Results</p>
          {results.map(c => (
            <button 
              key={c.id}
              onClick={() => setSelectedCustomer(c)}
              className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500">
                  <User size={20} />
                </div>
                <div>
                  <p className="font-bold text-zinc-900">{c.first_name} {c.last_name}</p>
                  <p className="text-sm text-zinc-500">{c.email}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-blue-600">View History →</span>
            </button>
          ))}
        </div>
      )}

      {/* DETAILED CUSTOMER VIEW */}
      {selectedCustomer && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-end mb-6">
             <div>
                <button 
                    onClick={() => setSelectedCustomer(null)}
                    className="text-sm text-zinc-500 hover:text-zinc-800 flex items-center mb-2"
                >
                    <X size={14} className="mr-1" /> Back to results
                </button>
                <h2 className="text-3xl font-bold text-zinc-900">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                </h2>
                <p className="text-zinc-500">{selectedCustomer.email} • {selectedCustomer.phone}</p>
             </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Active Submittals Column */}
            <div className="bg-white border rounded-2xl overflow-hidden">
                <div className="p-4 border-b bg-blue-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-blue-900 uppercase tracking-tight flex items-center">
                        <FileText size={16} className="mr-2" /> Active Submittals
                    </h3>
                </div>
                <div className="p-4 space-y-3">
                    {selectedCustomer.quote_submittals
                      ?.filter((s: any) => !s.jobs || s.jobs.length === 0)
                      .map((s: any) => (
                        <div key={s.id} className="p-3 border rounded-xl group flex justify-between items-center hover:bg-zinc-50">
                            <div>
                                <p className="text-sm font-bold">{s.job_name}</p>
                                <p className="text-xs text-zinc-500">#{s.quote_number} • {s.status}</p>
                            </div>
                            <Link href={`/submittals/${s.id}`} className="text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition">
                                View Details
                            </Link>
                        </div>
                    ))}
                    {selectedCustomer.quote_submittals?.filter((s: any) => !s.jobs || s.jobs.length === 0).length === 0 && (
                      <p className="text-sm text-zinc-400 italic p-2">No active submittals.</p>
                    )}
                </div>
            </div>

            {/* Won Jobs Column */}
            <div className="bg-white border rounded-2xl overflow-hidden">
                <div className="p-4 border-b bg-emerald-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-tight flex items-center">
                        <Briefcase size={16} className="mr-2" /> Completed Jobs
                    </h3>
                </div>
                <div className="p-4 space-y-3">
                    {selectedCustomer.quote_submittals
                      ?.filter((s: any) => s.jobs && s.jobs.length > 0)
                      .map((s: any) => (
                        <div key={s.id} className="p-3 border rounded-xl group flex justify-between items-center hover:bg-zinc-50">
                            <div>
                                <p className="text-sm font-bold">{s.job_name}</p>
                                <p className="text-xs text-zinc-500">#{s.quote_number} • Converted to Job</p>
                            </div>
                            {/* We link directly to the job record since we know it exists */}
                            <Link href={`/jobs/${s.jobs[0].id}`} className="text-xs font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition">
                                View Job
                            </Link>
                        </div>
                    ))}
                    {selectedCustomer.quote_submittals?.filter((s: any) => s.jobs && s.jobs.length > 0).length === 0 && (
                      <p className="text-sm text-zinc-400 italic p-2">No won jobs yet.</p>
                    )}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}