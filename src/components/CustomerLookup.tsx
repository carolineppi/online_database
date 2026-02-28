'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { UserPlus, Check } from 'lucide-react';

export default function CustomerLookup({ submittalId, currentCustomerName }: { submittalId: string, currentCustomerName: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [linked, setLinked] = useState(false);
  const supabase = createClient();

// src/components/CustomerLookup.tsx

  const searchCustomers = async (val: string) => {
    setQuery(val);
    if (val.length < 2) {
      setResults([]);
      return;
    }
    
    // We now search against 'searchable_phone' which the DB handles as text
    const { data, error } = await supabase
      .from('customers')
      .select('id, first_name, last_name, phone') 
      .or(`first_name.ilike.%${val}%,last_name.ilike.%${val}%,searchable_phone.ilike.%${val}%`)
      .limit(5);

    if (error) {
      console.error("Search Error:", error.message);
      return;
    }

    const formattedResults = data?.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name} (${c.phone || 'No Phone'})`
    }));

    setResults(formattedResults || []);
  };

  const linkCustomer = async (customerId: string) => {
    // Convert the string ID from the UI to a number for the int8 column
    const idAsNumber = parseInt(customerId, 10);

    const { error } = await supabase
      .from('quote_submittals')
      .update({ customer: idAsNumber }) // Updated to use 'customer' instead of 'customer_id'
      .eq('id', submittalId);

    if (error) {
      console.error("Link Error:", error.message);
      return;
    }

  setLinked(true);
  // Optional: Trigger a refresh so the parent server component updates
  window.location.reload(); 
};

  if (linked) return <div className="text-green-600 flex items-center gap-2 font-bold"><Check size={16}/> Customer Linked</div>;

  return (
    <div className="bg-zinc-100 p-4 rounded-lg">
      <label className="text-xs font-bold text-zinc-500 uppercase">Link Official Customer</label>
      <input 
        type="text"
        className="w-full mt-2 p-2 rounded border"
        placeholder={`Search for ${currentCustomerName}...`}
        value={query}
        onChange={(e) => searchCustomers(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="mt-2 bg-white border rounded shadow-lg">
          {results.map(c => (
            <li 
              key={c.id} 
              onClick={() => linkCustomer(c.id)}
              className="p-2 hover:bg-blue-50 cursor-pointer text-sm flex justify-between"
            >
              {c.name} <UserPlus size={14} className="text-zinc-400" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}