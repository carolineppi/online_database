'use client';

import { useState, useEffect } from 'react';
import { Truck, X, Search, Navigation } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

const CARRIERS = [
  { name: 'AAA Cooper', site: 'https://www.aaacooper.com/pwb/Transit/ProTrackResults.aspx', phone: '334-793-2284' },
  { name: 'Aduiepyle', site: 'https://www.aduiepyle.com/', phone: '800-523-5020' },
  { name: 'ABF', site: 'https://arcb.com/tools/tracking.html', phone: '800-610-5544' },
  { name: 'Dayton', site: 'https://www.daytonfreight.com/', phone: '800-860-5102' },
  { name: 'DHE', site: 'https://www.dhetransport.com', phone: '909-510-6103' },
  { name: 'Emiliani', site: 'Please call Emiliani Transport', phone: '570-291-0232' },
  { name: 'Fedex FR', site: 'https://www.fedex.com/en-us/tracking.html', phone: '866-393-4585' },
  { name: 'Fedex GR', site: 'https://www.fedex.com/en-us/tracking.html', phone: '800-463-3339' },
  { name: 'NEMF', site: 'https://www.nemf.com/', phone: '' },
  { name: 'Old Dom', site: 'https://www.odfl.com/us/en/tools/trace-track-ltl-freight/trace.html', phone: '800-235-5569' },
  { name: 'PittOhio', site: 'https://pittohio.com/myPittOhio/Shipping/LTL/TraceRequest', phone: '800-291-7488' },
  { name: 'Reddaway', site: 'https://www.reddawayregional.com/', phone: '888-420-8960' },
  { name: 'R&L', site: 'https://www2.rlcarriers.com/freight/shipping/shipment-tracing', phone: '800-543-5589' },
  { name: 'SAIA', site: 'https://www.saia.com/track', phone: '800-765-7242' },
  { name: 'SEFL', site: 'https://sefl.com/Tracing/index.jsp', phone: '800-637-7335' },
  { name: 'UPS', site: 'https://www.ups.com/track?loc=en_US&requester=ST/', phone: '800-742-5877' },
  { name: 'XPO', site: 'https://app.ltl.xpo.com/appjs/tracking/#/tracking', phone: '800-755-2728' },
  { name: 'YRCC', site: 'https://my.yrc.com/tools/track/shipments?referenceNumberType=PRO', phone: '' },
];

export default function TrackingMailer({ job, onClose }: { job: any, onClose: () => void }) {
  const [customerEmail, setCustomerEmail] = useState('');
  const [poNumber, setPoNumber] = useState(job.quote_submittals?.quote_number || '');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [freightWebsite, setFreightWebsite] = useState('');
  const [freightPhone, setFreightPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    // Fetch Customer Email
    const fetchCustomerInfo = async () => {
      const customerId = job.quote_submittals?.customer;
      if (!customerId) return;
      const { data } = await supabase.from('customers').select('email').eq('id', customerId).single();
      if (data) setCustomerEmail(data.email);
    };

    // Fetch Recent Tracking Submissions
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('tracking_mailer')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
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
      // 1. Insert into tracking_mailer table
      const { error } = await supabase.from('tracking_mailer').insert({
        customer_email: customerEmail,
        po_number: poNumber,
        tracking_number: trackingNumber,
        freight_website: freightWebsite,
        freight_phone: freightPhone
      });

      if (error) throw error;

      // 2. Call your API route to actually send the email
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

      if (!res.ok) throw new Error("Failed to dispatch email");

      toast.success('Tracking email dispatched successfully!');
      onClose();
    } catch (err: any) {
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
                <input required type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">PO Number</label>
                <input required type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-bold text-zinc-600" />
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
                {CARRIERS.map(carrier => (
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

          {/* Recent Submissions */}
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
                    {recentSubmissions.map((sub: any) => (
                      <tr key={sub.id}>
                        <td className="px-6 py-3 text-zinc-500 font-medium">{new Date(sub.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-3 font-bold text-zinc-800">{sub.customer_email}</td>
                        <td className="px-6 py-3 text-zinc-600 font-mono">#{sub.po_number}</td>
                      </tr>
                    ))}
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