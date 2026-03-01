'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Search, User, Briefcase, FileText } from 'lucide-react';

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchCustomers = async () => {
      // Fetch customers and their related submittals in one go
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          quote_submittals (*)
        `)
        .order('last_name', { ascending: true });

      if (data) setCustomers(data);
      setLoading(false);
    };

    fetchCustomers();
  }, []);

  // ... (keep previous imports and fetch logic)

  const filteredCustomers = customers.filter(c => 
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Define the "Won" status string exactly as it appears in your DB
  const WON_STATUS = "Won";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* ... (keep header and search bar) */}

      <div className="grid gap-6">
        {filteredCustomers.map(customer => {
        // Inside your customer loop...
        const submittals = customer.quote_submittals || [];

        // Use .trim() to ignore accidental spaces and ensure exact matching
        const WON_STATUS = "Won";

        const jobs = submittals.filter((s: any) => 
          s.status?.toString().toUpperCase().trim() === "Won"
        );

        const activeSubmittals = submittals.filter((s: any) => 
          s.status?.toString().trim() !== WON_STATUS
        );

          return (
            <div key={customer.id} className="bg-white border rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 bg-zinc-50 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">
                    {customer.first_name} {customer.last_name}
                  </h2>
                  <p className="text-sm text-zinc-500">{customer.email} • {customer.phone}</p>
                </div>
                <button className="px-4 py-2 bg-white border rounded-lg text-sm font-medium hover:bg-zinc-100 transition">
                  Edit Profile
                </button>
              </div>

              <div className="grid md:grid-cols-2 divide-x">
                {/* 1. ACTIVE SUBMITTALS COLUMN */}
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center">
                    <FileText size={16} className="mr-2" /> Active Submittals ({activeSubmittals.length})
                  </h3>
                  <div className="space-y-3">
                    {activeSubmittals.length > 0 ? activeSubmittals.map((s: any) => (
                      <div key={s.id} className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center group">
                        <div>
                          <p className="text-sm font-bold text-blue-900">{s.job_name}</p>
                          <p className="text-xs text-blue-700">#{s.quote_number} • <span className="capitalize">{s.status.toLowerCase()}</span></p>
                        </div>
                        <a href={`/submittals/${s.id}`} className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-white px-3 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          View Details
                        </a>
                      </div>
                    )) : <p className="text-sm text-zinc-400 italic">No active requests.</p>}
                  </div>
                </div>

                {/* 2. COMPLETED JOBS COLUMN */}
                <div className="p-6 bg-zinc-50/30">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center">
                    <Briefcase size={16} className="mr-2" /> Won Jobs ({jobs.length})
                  </h3>
                  <div className="space-y-3">
                    {jobs.length > 0 ? jobs.map((j: any) => (
                      <div key={j.id} className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-emerald-900">{j.job_name}</p>
                          <p className="text-xs text-emerald-700">#{j.quote_number} • Converted to Job</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                        <a href={`/jobs/${j.id}`} className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-white px-3 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          View Details
                        </a>
                        </div>
                      </div>
                    )) : <p className="text-sm text-zinc-400 italic">No jobs closed yet.</p>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}