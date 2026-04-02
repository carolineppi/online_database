'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Save, X, Phone, Mail, Briefcase, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

// Added initialPhone to the props interface
interface CreateSubmittalFormProps {
  onClose: () => void;
  initialPhone?: string; 
}

export default function CreateSubmittalForm({ onClose, initialPhone = '' }: CreateSubmittalFormProps) {
  // Visual Formatter: (XXX) XXX-XXXX
  const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  // Correctly initialize state with the formatted version of initialPhone
  const [phoneDisplay, setPhoneDisplay] = useState(formatPhoneNumber(initialPhone));
  const [loading, setLoading] = useState(false);
  const [matchingCustomer, setMatchingCustomer] = useState<any>(null);
  const [pendingData, setPendingData] = useState<any>(null);
  
  const supabase = createClient();
  const router = useRouter();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPhoneNumber(e.target.value);
    setPhoneDisplay(formattedValue);
  };

  const handleInitialSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    
    // SANITIZATION: Strip all formatting
    const rawPhone = phoneDisplay.replace(/\D/g, ''); 
    
    if (rawPhone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number.");
      setLoading(false);
      return;
    }

    const phoneNumeric = parseInt(rawPhone, 10);

    const submittalData = {
      job_name: formData.get('job_name'),
      first_name: formData.get('first_name'),
      last_name: formData.get('last_name'),
      email: email,
      phone: phoneNumeric, 
    };

    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .or(`email.eq.${email},phone.eq.${phoneNumeric}`)
      .maybeSingle();

    if (existing) {
      setMatchingCustomer(existing);
      setPendingData(submittalData);
      setLoading(false);
    } else {
      await finalizeCreation(submittalData, null);
    }
  };

  const finalizeCreation = async (data: any, existingCustomerId: number | null) => {
    setLoading(true);
    let finalCustomerId = existingCustomerId;

    try {
      // Logic for employee name code
      const savedEmployee = localStorage.getItem('employee');
      const employee = savedEmployee ? JSON.parse(savedEmployee) : null;
      const nameCode = employee?.name_code || 'XX';

      const { data: nextSeq } = await supabase.rpc('get_next_quote_number');
      const finalQuoteNumber = `${nextSeq}${nameCode}`;

      if (!finalCustomerId) {
        const { data: newCust, error: custError } = await supabase
          .from('customers')
          .insert([{
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: data.phone
          }])
          .select().single();

        if (custError) throw custError;
        finalCustomerId = newCust.id;
      }

      const { data: submittal, error: subError } = await supabase
        .from('quote_submittals')
        .insert([{
          job_name: data.job_name,
          quote_number: finalQuoteNumber,
          status: 'Pending',
          customer: finalCustomerId,
          quote_source: 'PM Input', // ADD THIS LINE
        }])
        .select().single();

      if (subError) throw subError;

      toast.success(`Submittal ${finalQuoteNumber} Created!`);
      router.push(`/submittals/${submittal.id}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative">
        {matchingCustomer && (
          <div className="absolute inset-0 bg-white z-10 p-8 flex flex-col items-center justify-center text-center">
             <h3 className="text-xl font-bold mb-2">Existing Customer Found</h3>
             <p className="mb-6 text-zinc-500">
                Link this submittal to <strong>{matchingCustomer.first_name} {matchingCustomer.last_name}</strong>?
             </p>
             <div className="flex gap-4 w-full">
                <button onClick={() => finalizeCreation(pendingData, matchingCustomer.id)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700">Yes, Link</button>
                <button onClick={() => finalizeCreation(pendingData, null)} className="flex-1 bg-zinc-100 py-3 rounded-xl font-bold hover:bg-zinc-200">No, Create New</button>
             </div>
          </div>
        )}

        <div className="p-6 border-b flex justify-between items-center bg-zinc-50">
          <h3 className="font-bold text-xl text-zinc-900">New Submittal</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition"><X size={20}/></button>
        </div>
        
        <form onSubmit={handleInitialSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Project Name</label>
            <input name="job_name" placeholder="e.g., Office Renovation" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input name="first_name" placeholder="First Name" className="p-3 border rounded-xl" required />
            <input name="last_name" placeholder="Last Name" className="p-3 border rounded-xl" required />
            <input name="email" type="email" placeholder="Email" className="p-3 border rounded-xl" required />
            
            <input 
              value={phoneDisplay}
              onChange={handlePhoneChange}
              placeholder="(555) 000-0000"
              maxLength={14}
              className="p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              required 
            />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition disabled:opacity-50">
            {loading ? 'Processing...' : 'Create Submittal'}
          </button>
        </form>
      </div>
    </div>
  );
}