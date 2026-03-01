'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function RecentActivity() {
  const [submittals, setSubmittals] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // 1. Initial Fetch for "Pending" submittals
    const fetchSubmittals = async () => {
      const { data } = await supabase
        .from('quote_submittals')
        .select('*, customers(first_name, last_name)')
        // This ensures that as soon as you change the status to 'Quoted', it disappears
        .eq('status', 'Pending') 
        .order('created_at', { ascending: false });

      if (data) setSubmittals(data);
    };

    fetchSubmittals();

    // 2. Set up Realtime listener
    const channel = supabase
        .channel('db-status-updates')
        .on(
          'postgres_changes',
          { 
            event: '*', // Listen for ALL events (especially UPDATE)
            schema: 'public', 
            table: 'quote_submittals' 
          },
          (payload) => {
            // If a submittal's status changes to 'Quoted', 
            // this re-fetch will exclude it from the list automatically.
            fetchSubmittals(); 
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <span className="relative flex h-3 w-3 mr-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        Recent Web Submittals
      </h2>

      <div className="space-y-4">
        {submittals.length === 0 ? (
          <p className="text-gray-500 italic">No pending submittals.</p>
        ) : (
          submittals.map((item) => (
            <div key={item.id} className="border-b pb-3 last:border-0 hover:bg-gray-50 transition-colors p-2 rounded">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-blue-600">#{item.quote_number}</p>
                  <p className="text-sm font-medium">{item.customers?.first_name} {item.customers?.last_name}</p>
                  <p className="text-xs text-gray-500">{item.job_name}</p>
                </div>
                <div className="text-right">
                   <Link 
                    href={`/submittals/${item.id}`}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded border transition"
                   >
                    View Details
                  </Link>
                  {item.pdf_url && (
                    <a href={item.pdf_url} target="_blank" className="block text-[10px] text-red-500 mt-1 underline">
                      PDF Attached
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}