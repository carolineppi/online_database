'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { X, Loader2, User, Phone, Mail, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

// Accepts an optional initialCustomer to pre-populate the form
export default function CreateSubmittalForm({ onClose, initialCustomer }: { onClose: () => void, initialCustomer?: any }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    job_name: '',
    first_name: initialCustomer?.first_name || '',
    last_name: initialCustomer?.last_name || '',
    email: initialCustomer?.email || '',
    phone: initialCustomer?.phone || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Get the current user's email to find their Name Code
      // Logic for employee name code
      const savedEmployee = localStorage.getItem('employee');
      const employee = savedEmployee ? JSON.parse(savedEmployee) : null;
      const nameCode = employee?.name_code || 'XX';

      // 2. Generate the Secure Quote Number via the new Database RPC!
      const { data: finalQuoteNumber, error: rpcError } = await supabase.rpc('generate_quote_number', {
        name_code: nameCode
      });

      if (rpcError || !finalQuoteNumber) {
        throw new Error("Failed to generate a secure quote number.");
      }

      // 3. Handle Customer Association
      let customerId = initialCustomer?.id; // Use existing ID if launched from the Customer Directory

      if (!customerId) {
        // If not launched from directory, look up by email, or create new
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', formData.email)
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer, error: custError } = await supabase
            .from('customers')
            .insert({
              first_name: formData.first_name,
              last_name: formData.last_name,
              email: formData.email,
              phone: formData.phone
            })
            .select()
            .single();

          if (custError) throw custError;
          customerId = newCustomer.id;
        }
      }

      // 4. Create the Submittal using the generated number
      const { data: submittal, error: subError } = await supabase
        .from('quote_submittals')
        .insert({
          job_name: formData.job_name,
          quote_number: finalQuoteNumber,
          customer: customerId,
          quote_source: 'PM Input', // Flags as a manual entry for financials
          status: 'PENDING'
        })
        .select()
        .single();

      if (subError) throw subError;

      toast.success("Submittal created!");
      router.push(`/submittals/${submittal.id}`); // Route immediately to the new submittal
      onClose();

    } catch (err: any) {
      toast.error(err.message || "Failed to create submittal");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95">
        
        <div className="flex justify-between items-center p-6 border-b border-zinc-100 bg-zinc-50/50">
          <div>
            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">Manual Submittal</h2>
            {initialCustomer && (
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">
                Creating for: {initialCustomer.first_name} {initialCustomer.last_name}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">
              <Briefcase size={14} /> Job / Project Name
            </label>
            <input 
              required
              autoFocus
              value={formData.job_name}
              onChange={(e) => setFormData({...formData, job_name: e.target.value})}
              placeholder="e.g. Target Remodel - Dallas"
              className="w-full p-4 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-bold text-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">
                <User size={14} /> First Name
              </label>
              <input 
                required
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                className="w-full p-4 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest block">
                Last Name
              </label>
              <input 
                required
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                className="w-full p-4 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">
              <Mail size={14} /> Email Address
            </label>
            <input 
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full p-4 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">
              <Phone size={14} /> Phone Number
            </label>
            <input 
              required
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full p-4 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-zinc-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 transition shadow-xl shadow-zinc-200 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : null}
            {loading ? 'Creating Project...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
}