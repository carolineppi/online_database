'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { UserPlus, Save, Users, Shield, Truck, Key, Megaphone, Palette, Trash2, Loader2, Star, Factory } from 'lucide-react';
import { toast } from 'sonner';
import ManageCarriers from '@/components/ManageCarriers';
import ManageSources from '@/components/ManageSources';
import ManageColors from '@/components/ManageColors';
import ManageReviews from '@/components/ManageReviews';
import ManageManufacturers from '@/components/ManageManufacturers'; // --- ADDED IMPORT ---


export default function SettingsPage() {
  // --- ADDED 'manufacturers' to state ---
  const [activeTab, setActiveTab] = useState<'team' | 'carriers' | 'security' | 'sources' | 'colors' | 'reviews' | 'manufacturers'>('team');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // New state for team list
  const [employees, setEmployees] = useState<any[]>([]);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  
  const supabase = createClient();

  // Fetch the logged-in user on mount
  useEffect(() => {
    const saved = localStorage.getItem('employee');
    if (saved) {
      setCurrentUser(JSON.parse(saved));
    }
  }, []);

  // Fetch employees when the Team tab is active
  useEffect(() => {
    if (activeTab === 'team') {
      fetchEmployees();
    }
  }, [activeTab]);

  const fetchEmployees = async () => {
    setFetchingEmployees(true);
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('first_name', { ascending: true });
    
    if (!error && data) {
      setEmployees(data);
    }
    setFetchingEmployees(false);
  };

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
      fetchEmployees(); // Refresh the list
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}? This action cannot be undone.`)) return;
    
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${name} has been removed.`);
      fetchEmployees(); // Refresh the list
    }
  };

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return toast.error("User session not found.");
    
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const currentPass = formData.get('current_password') as string;
    const newPass = formData.get('new_password') as string;
    const confirmPass = formData.get('confirm_password') as string;

    // 1. Verify new passwords match
    if (newPass !== confirmPass) {
      toast.error("New passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      // 2. Verify current password is correct
      const { data: verifyUser, error: verifyError } = await supabase
        .from('employees')
        .select('id')
        .eq('id', currentUser.id)
        .eq('password', currentPass)
        .single();

      if (verifyError || !verifyUser) {
        throw new Error("Incorrect current password.");
      }

      // 3. Update to the new password
      const { error: updateError } = await supabase
        .from('employees')
        .update({ password: newPass })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      toast.success("Password updated successfully!");
      
      // Update localStorage so the session stays valid
      const updatedSession = { ...currentUser, password: newPass };
      localStorage.setItem('employee', JSON.stringify(updatedSession));
      setCurrentUser(updatedSession);
      
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pl-64 min-h-screen bg-gray-50">
    <div className="p-8 max-w-6xl mx-auto">
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

          {/* --- ADDED MANUFACTURERS BUTTON --- */}
          <button 
            onClick={() => setActiveTab('manufacturers')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold border transition ${
              activeTab === 'manufacturers' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'text-zinc-500 hover:bg-white hover:border-zinc-200 border-transparent'
            }`}
          >
            <Factory size={18} /> Manufacturers
          </button>

          <button 
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold border transition ${
              activeTab === 'security' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'text-zinc-500 hover:bg-white hover:border-zinc-200 border-transparent'
            }`}
          >
            <Shield size={18} /> Security
          </button>

          <button 
            onClick={() => setActiveTab('sources')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold border transition ${
              activeTab === 'sources' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'text-zinc-500 hover:bg-white hover:border-zinc-200 border-transparent'
            }`}
          >
            <Megaphone size={18} /> Marketing Sources
          </button>    
          <button 
            onClick={() => setActiveTab('colors')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold border transition ${
              activeTab === 'colors' ? 'bg-pink-50 text-pink-700 border-pink-100' : 'text-zinc-500 hover:bg-white hover:border-zinc-200 border-transparent'
            }`}
          >
            <Palette size={18} /> Material Colors
          </button>
          <button 
            onClick={() => setActiveTab('reviews')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold border transition ${
              activeTab === 'reviews' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'text-zinc-500 hover:bg-white hover:border-zinc-200 border-transparent'
            }`}
          >
            <Star size={18} /> Automated Reviews
          </button>
        </div>

        {/* Main Settings Content */}
        <div className="md:col-span-3">
          
          {/* TEAM TAB */}
          {activeTab === 'team' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              
              {/* Add Estimator Form */}
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
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

              {/* Current Team List */}
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b bg-zinc-50/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-zinc-100 text-zinc-600 rounded-xl flex items-center justify-center">
                      <Users size={20} />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-zinc-900">Current Team</h2>
                      <p className="text-xs text-zinc-500 uppercase font-black">Manage existing team members</p>
                    </div>
                  </div>
                  {fetchingEmployees && <Loader2 className="animate-spin text-zinc-400" size={20} />}
                </div>
                
                <div className="p-0">
                  {employees.length === 0 && !fetchingEmployees ? (
                    <div className="p-8 text-center text-zinc-500 font-medium">No team members found.</div>
                  ) : (
                    <ul className="divide-y divide-zinc-100">
                      {employees.map(emp => (
                        <li key={emp.id} className="flex items-center justify-between p-6 hover:bg-zinc-50 transition group">
                          <div>
                            <p className="font-bold text-zinc-900 flex items-center gap-2">
                              {emp.first_name} {emp.last_name} 
                              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md tracking-widest uppercase">
                                {emp.name_code}
                              </span>
                              {currentUser?.id === emp.id && (
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md tracking-widest uppercase">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-zinc-500 font-medium mt-1">{emp.email}</p>
                          </div>
                          
                          {/* Prevent user from deleting themselves */}
                          {currentUser?.id !== emp.id && (
                            <button 
                              onClick={() => handleDeleteEmployee(emp.id, `${emp.first_name} ${emp.last_name}`)}
                              className="text-zinc-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-red-50"
                              title="Remove Estimator"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* CARRIERS TAB */}
          {activeTab === 'carriers' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <ManageCarriers />
            </div>
          )}

          {/* --- NEW: MANUFACTURERS TAB --- */}
          {activeTab === 'manufacturers' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <ManageManufacturers />
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 border-b bg-zinc-50/50 flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                  <Key size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-zinc-900">Change Password</h2>
                  <p className="text-xs text-zinc-500 uppercase font-black">Update your account security credentials</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="p-6 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Current Password</label>
                  <input 
                    name="current_password" 
                    type="password" 
                    required 
                    placeholder="Enter your current password" 
                    className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-purple-500 rounded-xl outline-none transition font-medium" 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">New Password</label>
                    <input 
                      name="new_password" 
                      type="password" 
                      required 
                      placeholder="Enter new password" 
                      className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-purple-500 rounded-xl outline-none transition font-medium" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Confirm New Password</label>
                    <input 
                      name="confirm_password" 
                      type="password" 
                      required 
                      placeholder="Re-type new password" 
                      className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-purple-500 rounded-xl outline-none transition font-medium" 
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-purple-600 transition shadow-lg shadow-zinc-200 disabled:opacity-50"
                  >
                    <Shield size={16} /> {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
          {activeTab === 'sources' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <ManageSources />
            </div>
          )}
          {/* COLORS TAB */}
          {activeTab === 'colors' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <ManageColors />
            </div>
          )}
          {/* REVIEWS TAB */}
          {activeTab === 'reviews' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <ManageReviews />
            </div>
          )}
        </div>
      </div>
    </div>
    </main>
  );
}