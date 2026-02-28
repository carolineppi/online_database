'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Search, ChevronRight, Plus } from 'lucide-react'; // Added Plus icon
import Link from 'next/link';
import CreateSubmittalForm from '@/components/CreateSubmittalForm'; // Import the new form

export default function SubmittalFeed() {
  const [searchTerm, setSearchTerm] = useState('');
  const [submittals, setSubmittals] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false); // State to control the modal
  const supabase = createClient();

  useEffect(() => {
    const fetchSubmittals = async () => {
      const { data } = await supabase
        .from('quote_submittals')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setSubmittals(data);
    };
    fetchSubmittals();
  }, [supabase]);

  const filtered = submittals.filter(s => 
    s.job_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.quote_number.toString().includes(searchTerm)
  );

  return (
    <div className="p-8 bg-zinc-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        
        {/* Header with New Action Button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Inbound Submittals</h1>
            <p className="text-sm text-zinc-500">Manage digital leads and manual entries</p>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
          >
            <Plus size={18} /> New Entry
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text"
            placeholder="Search by Job Name or Quote #..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table View */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Job Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Quote #</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-zinc-400">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-blue-50/30 transition">
                  <td className="px-6 py-4 font-semibold text-zinc-900">{s.job_name}</td>
                  <td className="px-6 py-4 text-zinc-500">#{s.quote_number}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      s.status === 'Won' 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {s.status === 'Won' ? 'WON / JOB CREATED' : (s.status || 'PENDING')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/submittals/${s.id}`} className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline">
                      View Details <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-400">
                    No submittals found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay for Manual Creation */}
      {showForm && (
        <CreateSubmittalForm onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}