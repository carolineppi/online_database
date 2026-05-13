'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Users, Save, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditCustomerModalProps {
  customer: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditCustomerModal({ customer, onClose, onSuccess }: EditCustomerModalProps) {
  const supabase = createClient();
  const [isSaving, setIsSaving] = useState(false);
  
  // Initialize form with the passed-in customer data
  const [editForm, setEditForm] = useState({
    first_name: customer.first_name || '',
    last_name: customer.last_name || '',
    email: customer.email || '',
    phone: customer.phone ? String(customer.phone) : ''
  });

  const handleSaveEdit = async () => {
    setIsSaving(true);

    try {
      const cleanFirst = editForm.first_name?.trim() || null;
      const cleanLast = editForm.last_name?.trim() || null;
      const cleanEmail = editForm.email?.trim() || null;
      
      const phoneDigits = editForm.phone?.replace(/\D/g, '');
      const cleanPhone = phoneDigits ? Number(phoneDigits) : null;

      // Look for an EXACT duplicate in the database (ignoring the one we are editing)
      let matchQuery = supabase.from('customers').select('id').neq('id', customer.id);
      
      cleanFirst ? matchQuery = matchQuery.eq('first_name', cleanFirst) : matchQuery = matchQuery.is('first_name', null);
      cleanLast ? matchQuery = matchQuery.eq('last_name', cleanLast) : matchQuery = matchQuery.is('last_name', null);
      cleanEmail ? matchQuery = matchQuery.eq('email', cleanEmail) : matchQuery = matchQuery.is('email', null);
      cleanPhone ? matchQuery = matchQuery.eq('phone', cleanPhone) : matchQuery = matchQuery.is('phone', null);

      const { data: matchData, error: matchError } = await matchQuery.maybeSingle();
      if (matchError) throw matchError;

      if (matchData) {
        // MATCH FOUND: Initiate Merge
        const targetId = matchData.id;

        const { error: updateQuotesError } = await supabase
          .from('quote_submittals')
          .update({ customer: targetId })
          .eq('customer', customer.id);
        if (updateQuotesError) throw updateQuotesError;

        const { error: deleteError } = await supabase
          .from('customers')
          .delete()
          .eq('id', customer.id);
        if (deleteError) throw deleteError;

        toast.success("Duplicate found! Profiles and history successfully merged.");
      } else {
        // NO MATCH: Update normally
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            first_name: cleanFirst,
            last_name: cleanLast,
            email: cleanEmail,
            phone: cleanPhone
          })
          .eq('id', customer.id);
        
        if (updateError) throw updateError;
        toast.success("Customer information updated.");
      }

      onSuccess(); // Triggers the refresh on the parent page

    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to update customer.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h3 className="font-bold text-zinc-900 text-lg">Edit Customer</h3>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition p-1"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">First Name</label>
              <input 
                type="text" 
                value={editForm.first_name}
                onChange={e => setEditForm({...editForm, first_name: e.target.value})}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Last Name</label>
              <input 
                type="text" 
                value={editForm.last_name}
                onChange={e => setEditForm({...editForm, last_name: e.target.value})}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Email Address</label>
            <input 
              type="email" 
              value={editForm.email}
              onChange={e => setEditForm({...editForm, email: e.target.value})}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Phone Number</label>
            <input 
              type="tel" 
              value={editForm.phone}
              onChange={e => setEditForm({...editForm, phone: e.target.value})}
              placeholder="(555) 555-5555"
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
            />
          </div>
          
          <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-xl flex gap-2 items-start mt-2">
            <Users size={16} className="shrink-0 text-blue-600" />
            <p>If you change this info to exactly match another customer, their profiles and quote histories will be automatically merged.</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 transition"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button 
            onClick={handleSaveEdit}
            disabled={isSaving}
            className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}