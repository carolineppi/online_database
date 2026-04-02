'use client';

import { useState, useEffect } from 'react';
import { Truck, X, Search, Navigation } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function TrackingMailer({ job, onClose }: { job: any, onClose: () => void }) {
  const [customerEmail, setCustomerEmail] = useState('');
  const [poNumber] = useState(job.quote_submittals?.quote_number || '');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [freightWebsite, setFreightWebsite] = useState('');
  const [freightPhone, setFreightPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    // 1. Fetch Customer Email for the UI and the API payload
    const fetchCustomerInfo = async () => {
      const customerId = job.quote_submittals?.customer;
      if (!customerId) return;
      const { data } = await supabase.from('customers').select('email').eq('id', customerId).single();
      if (data) setCustomerEmail(data.email);
    };

    const fetchCarriers = async () => {
      const { data } = await supabase.from('carriers').select('*').order('name');
      if (data) setCarriers(data);
    };
    fetchCarriers();

    // 2. Fetch Recent Tracking Submissions using Relational Joins
    const fetchRecent = async () => {
      const { data, error } = await supabase
        .from('tracking_mailer')
        .select(`
          id,
          created_at,
          tracking_number,
          jobs (
            quote_submittals (
              quote_number,
              customers!customer (
                email
              )
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) console.error("Error fetching recent:", error);
      if (data) setRecentSubmissions(data);
    };

    fetchCustomerInfo();
    fetchRecent();
  }, [job, supabase]);

  const setCarrierInfo = (site: string, phone: string) => {
    setFreightWebsite(site);
    setFreightPhone(phone);
  };

const handleSendTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. ATTEMPT TO SEND EMAIL FIRST
      const res = await fetch('/api/send-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: customerEmail,
          po_number: poNumber,
          tracking_number: trackingNumber,
          freight_website: freightWebsite,
          freight_phone: freightPhone
        })
      });

      const responseData = await res.json();

      // If the API route returns an error status, throw it to stop the process
      if (!res.ok) {
        throw new Error(responseData.error || "Failed to dispatch email via SMTP");
      }

      // 2. IF EMAIL SUCCEEDS, SAVE TO DATABASE
      const { error: dbError } = await supabase.from('tracking_mailer').insert({
        job_id: job.id,
        tracking_number: trackingNumber,
        freight_website: freightWebsite,
        freight_phone: freightPhone
      });

      if (dbError) throw new Error("Email sent, but failed to log to database: " + dbError.message);

      toast.success('Tracking email dispatched successfully!');
      
      // Add the new submission to the UI immediately without requiring a refresh
      setRecentSubmissions(prev => [{
        id: Math.random(), // Temp ID for immediate UI update
        created_at: new Date().toISOString(),
        tracking_number: trackingNumber,
        jobs: {
          quote_submittals: {
            quote_number: poNumber,
            customers: { email: customerEmail }
          }
        }
      }, ...prev]);

      // Reset the form fields
      setTrackingNumber('');
      setFreightWebsite('');
      setFreightPhone('');

    } catch (err: any) {
      console.error("Tracking Error:", err);
      toast.error(err.message || 'Failed to send tracking info.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-y-auto max-h-[90vh] shadow-2xl">
        <form onSubmit={handleSendTracking} className="p-10">
          
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-black text-zinc-900 uppercase flex items-center gap-3">
                <Truck className="text-emerald-600" size={28} /> 
                Dispatch Tracking
              </h2>
              <p className="text-zinc-500 font-medium ml-10 mt-1">
                {job.quote_submittals?.job_name}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-2 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 transition">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN: Inputs */}
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Customer Email</label>
                {/* Disabled because it's derived from the job relation */}
                <input disabled type="email" value={customerEmail} className="w-full p-4 bg-zinc-100 rounded-2xl border-none text-zinc-500 font-bold cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">PO Number</label>
                {/* Disabled because it's derived from the job relation */}
                <input disabled type="text" value={poNumber} className="w-full p-4 bg-zinc-100 rounded-2xl border-none text-zinc-500 font-bold cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">PRO / Tracking #</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input required type="text" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="Tracking Number" className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-bold" />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Carriers Grid */}
            <div className="lg:col-span-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest mb-2 block">Quick Select Carrier</label>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {carriers.map(carrier => (
                  <button 
                    key={carrier.name} 
                    type="button" 
                    onClick={() => setCarrierInfo(carrier.site, carrier.phone)}
                    className="bg-white border border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50 text-zinc-600 hover:text-emerald-700 text-xs font-bold py-3 px-2 rounded-xl transition-all active:scale-95 shadow-sm"
                  >
                    {carrier.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Carrier Website</label>
                  <div className="relative">
                    <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input required type="text" value={freightWebsite} onChange={e => setFreightWebsite(e.target.value)} placeholder="URL" className="w-full p-4 pl-10 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition text-sm font-medium" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">Carrier Phone</label>
                  <input type="text" value={freightPhone} onChange={e => setFreightPhone(e.target.value)} placeholder="Phone" className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition text-sm font-medium" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-10 border-b border-zinc-100 pb-10">
            <button type="button" onClick={() => { setFreightWebsite(''); setFreightPhone(''); }} className="flex-1 p-5 rounded-2xl font-black text-zinc-500 hover:bg-zinc-100 transition uppercase tracking-widest text-[10px]">
              Clear Carrier
            </button>
            <button type="submit" disabled={isLoading} className="flex-[2] p-5 bg-zinc-900 text-white rounded-2xl font-black hover:bg-emerald-600 transition uppercase tracking-widest text-[10px] shadow-xl shadow-zinc-200 disabled:opacity-50">
              {isLoading ? "Dispatching..." : "Send Tracking Info"}
            </button>
          </div>

          {/* Recent Submissions Using Foreign Keys */}
          <div className="mt-8">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Recent Dispatches</h3>
            {recentSubmissions.length > 0 ? (
              <div className="bg-zinc-50 rounded-3xl border border-zinc-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">PO Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {recentSubmissions.map((sub: any) => {
                      // Extract joined data safely
                      const derivedEmail = sub.jobs?.quote_submittals?.customers?.email || 'Unknown';
                      const derivedPo = sub.jobs?.quote_submittals?.quote_number || 'Unknown';

                      return (
                        <tr key={sub.id}>
                          <td className="px-6 py-3 text-zinc-500 font-medium">{new Date(sub.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-3 font-bold text-zinc-800">{derivedEmail}</td>
                          <td className="px-6 py-3 text-zinc-600 font-mono">#{derivedPo}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 italic">No recent tracking emails sent.</p>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}