'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Edit3, Save, X, Globe, User, Megaphone } from 'lucide-react';
import { toast } from 'sonner';

function formatPhoneNumber(phoneNumberRaw: any): string {
  if (!phoneNumberRaw) return 'N/A';
  const stringData = String(phoneNumberRaw);
  const cleaned = stringData.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return stringData;
}

export default function SubmittalHeader({ submittal, isPaid, isManual, displayName }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const customer = submittal.linked_customer || {};

  const [formData, setFormData] = useState({
    job_name: submittal.job_name || '',
    first_name: customer.first_name || '',
    last_name: customer.last_name || '',
    phone: customer.phone || '',
    email: customer.email || ''
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Update the Job Name in quote_submittals
      const { error: subError } = await supabase
        .from('quote_submittals')
        .update({ job_name: formData.job_name })
        .eq('id', submittal.id);
      if (subError) throw subError;

      // 2. Update the Customer info in customers table (if a customer exists)
      if (customer.id) {
        const { error: custError } = await supabase
          .from('customers')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone,
            email: formData.email
          })
          .eq('id', customer.id);
        if (custError) throw custError;
      }

      toast.success("Details updated successfully!");
      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border rounded-3xl p-8 mb-8 shadow-sm relative group">
      {!isEditing && (
        <button 
          onClick={() => setIsEditing(true)}
          className="absolute top-6 right-6 p-2 text-zinc-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition opacity-0 group-hover:opacity-100"
          title="Edit Details"
        >
          <Edit3 size={20} />
        </button>
      )}

      {isEditing ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-lg font-black text-zinc-900 uppercase tracking-tight">Edit Project & Customer</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEditing(false)}
                className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-xl transition"
              >
                <X size={20} />
              </button>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition"
              >
                <Save size={14} /> {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Job / Project Name</label>
              <input 
                value={formData.job_name}
                onChange={(e) => setFormData({...formData, job_name: e.target.value})}
                className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-bold text-zinc-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">First Name</label>
              <input 
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-medium text-zinc-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Last Name</label>
              <input 
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-medium text-zinc-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Phone Number</label>
              <input 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-medium text-zinc-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Email Address</label>
              <input 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-medium text-zinc-900 outline-none"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pr-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-zinc-900">{submittal.job_name}</h1>
              <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-sm font-mono font-bold">
                #{submittal.quote_number}
              </span>
            </div>
            <p className="text-zinc-500 text-sm">
              Customer: {customer.first_name} {customer.last_name} | Phone: {formatPhoneNumber(customer.phone)} | Email: {customer.email || 'N/A'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${
              isPaid 
                ? 'bg-blue-50 border-blue-100 text-blue-700' 
                : isManual
                ? 'bg-purple-50 border-purple-100 text-purple-700'
                : 'bg-zinc-50 border-zinc-100 text-zinc-600'
            }`}>
              {isPaid ? <Megaphone size={18} /> : isManual ? <User size={18} /> : <Globe size={18} />}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                  {isPaid ? 'Paid Acquisition' : isManual ? 'Manual Entry' : 'Organic Traffic'}
                </p>
                <p className="text-sm font-bold">
                  {displayName}
                </p>
              </div>
            </div>

            <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
              submittal.status === 'WON' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {submittal.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}