'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { UserPlus, Save, Users, Shield, Truck } from 'lucide-react';
import { toast } from 'sonner';
import ManageCarriers from '@/components/ManageCarriers'; // Import the new component

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'team' | 'carriers'>('team');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('first_name') as string;
    const lastName = formData.get('last_name') as string;
    
    const nameCode = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

    const newEmployee = {
      first_name: firstName,
      last_name: lastName,
      email: formData.get('email'),
      phone: formData.get('phone'),
      password: formData.get('password'),
      name_code: nameCode,
    };

    try {
      const { error } = await supabase.from('employees').insert([newEmployee]);
      if (error) throw error;
      toast.success(`${firstName} ${lastName} added as a new estimator!`);
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto bg-zinc-50 min-h-screen">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tight">System Settings</h1>
        <p className="text-zinc-500">Manage your team and application preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Sidebar Navigation */}
        <div className="md:col-span-1 space-y-2">
          <button 
            onClick={() => setActiveTab('team')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold border transition ${
              activeTab === 'team' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'text-zinc-500 hover:bg-white hover:border-zinc-200 border-transparent'
            }`}
          >
            <Users size={18} /> Team
          </button>
          
          <button 
            onClick={() => setActiveTab('carriers')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold border transition ${
              activeTab === 'carriers' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'text-zinc-500 hover:bg-white hover:border-zinc-200 border-transparent'
            }`}
          >
            <Truck size={18} /> Freight Carriers
          </button>

          <button className="w-full flex items-center gap-3 p-4 rounded-2xl text-zinc-400 font-medium cursor-not-allowed border border-transparent">
            <Shield size={18} /> Security (Soon)
          </button>
        </div>

        {/* Main Settings Content */}
        <div className="md:col-span-3">
          
          {/* TEAM TAB */}
          {activeTab === 'team' && (
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-zinc-900">Add New Estimator</h2>
                  <p className="text-xs text-zinc-500 uppercase font-black">Create a new team member account</p>
                </div>
              </div>

              <form onSubmit={handleCreateUser} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">First Name</label>
                    <input name="first_name" required placeholder="e.g. John" className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Last Name</label>
                    <input name="last_name" required placeholder="e.g. Doe" className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Email Address</label>
                    <input name="email" type="email" required placeholder="john@partitionplus.com" className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Phone Number</label>
                    <input name="phone" required placeholder="e.g. 5551234567" className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Temporary Password</label>
                  <input name="password" type="password" required placeholder="Set an initial password" className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl outline-none transition font-medium" />
                  <p className="text-[10px] text-zinc-400 mt-2 font-bold uppercase">They can change this later. System will auto-generate their 2-letter Name Code (e.g., JD).</p>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition shadow-lg shadow-zinc-200 disabled:opacity-50">
                    <Save size={16} /> {loading ? 'Creating User...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* CARRIERS TAB */}
          {activeTab === 'carriers' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <ManageCarriers />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}