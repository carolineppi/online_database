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
    const cleanSearch = searchTerm.trim();
    if (!cleanSearch) return;

    setLoading(true);

    // Using the explicit constraint name and an alias 'jobs'
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        quote_submittals (
          *,
          jobs:jobs!fk_jobs_quote_submittal (*)
        )
      `)
      .or(`first_name.ilike.%${cleanSearch}%,last_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`)
      .limit(10);

    if (error) {
      console.error("Search Error:", error.message);
    } else {
      console.log("SEARCH DATA:", data); // Check if 'jobs' appears inside quote_submittals
      setResults(data || []);
      setSelectedCustomer(null);
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
        <input 
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search customers..."
          className="w-full pl-12 pr-24 py-4 text-lg border-2 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-sm"
        />
        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-5 py-2 rounded-xl font-semibold">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* No Results Flicker Fix */}
      {!loading && searchTerm && results.length === 0 && (
        <div className="text-center p-8 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
          <p className="text-zinc-500">No customers found matching "{searchTerm}"</p>
        </div>
      )}

      {/* Detailed View */}
      {selectedCustomer && (
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          {/* ACTIVE SUBMITTALS (No job record) */}
          <div className="bg-white border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-blue-900 mb-4 flex items-center">
              <FileText size={16} className="mr-2" /> ACTIVE SUBMITTALS
            </h3>
            {selectedCustomer.quote_submittals?.filter((s: any) => !s.jobs || s.jobs.length === 0).map((s: any) => (
              <div key={s.id} className="p-3 border rounded-xl mb-2 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold">{s.job_name}</p>
                  <p className="text-xs text-zinc-500">#{s.quote_number}</p>
                </div>
                <Link href={`/submittals/${s.id}`} className="text-xs font-bold text-blue-600">Details</Link>
              </div>
            ))}
          </div>

          {/* COMPLETED JOBS (Has job record) */}
          <div className="bg-white border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-emerald-900 mb-4 flex items-center">
              <Briefcase size={16} className="mr-2" /> COMPLETED JOBS
            </h3>
            {selectedCustomer.quote_submittals?.filter((s: any) => s.jobs && s.jobs.length > 0).map((s: any) => (
              <div key={s.id} className="p-3 border border-emerald-100 bg-emerald-50/20 rounded-xl mb-2 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-zinc-900">{s.job_name}</p>
                  <p className="text-xs text-zinc-500">
                    Sold for ${Number(s.jobs[0].sale_amount).toLocaleString()}
                  </p>
                </div>
                <Link href={`/submittals/${s.id}`} className="text-xs font-bold text-emerald-600">View</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}