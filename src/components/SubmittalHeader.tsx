"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Save,
  X,
  Globe,
  User,
  Megaphone,
  UserPlus,
  Search,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

function formatPhoneNumber(phoneNumberRaw: any): string {
  if (!phoneNumberRaw) return "N/A";
  const stringData = String(phoneNumberRaw);
  const cleaned = stringData.replace(/\D/g, "");
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return stringData;
}

export default function SubmittalHeader({
  submittal,
  isPaid,
  isManual,
  displayName,
}: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reassign Modal State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const customer = submittal.linked_customer || {};

  const [formData, setFormData] = useState({
    job_name: submittal.job_name || "",
    quote_number_mask: submittal.quote_number_mask || "",
    first_name: customer.first_name || "",
    last_name: customer.last_name || "",
    phone: customer.phone ? String(customer.phone) : "", // <-- Wrap in String()
    email: customer.email || "",
  });

  // Debounced search for the Reassign Modal
  useEffect(() => {
    if (!showReassignModal) return;

    const delayDebounceFn = setTimeout(() => {
      fetchCustomersForReassign(searchQuery);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, showReassignModal]);

  const fetchCustomersForReassign = async (query = "") => {
    setIsSearching(true);
    try {
      let request = supabase
        .from("customer_summary_stats")
        .select("id, full_name, email, phone, phone_text")
        .limit(10);

      if (query) {
        request = request.or(
          `full_name.ilike.%${query}%,email.ilike.%${query}%,phone_text.ilike.%${query}%`,
        );
      } else {
        request = request.order("quotes_count", { ascending: false });
      }

      const { data, error } = await request;
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to search customers.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error: subError } = await supabase
        .from("quote_submittals")
        .update({
          job_name: formData.job_name,
          quote_number_mask: formData.quote_number_mask,
        })
        .eq("id", submittal.id);
      if (subError) throw subError;

      if (customer.id) {
        const { error: custError } = await supabase
          .from("customers")
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone
              ? String(formData.phone).replace(/\D/g, "")
              : null, // <-- Wrap in String()
            email: formData.email,
          })
          .eq("id", customer.id);
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

  const handleReassignCustomer = async (newCustomerId: string) => {
    setIsReassigning(true);
    try {
      const { error } = await supabase
        .from("quote_submittals")
        .update({ customer: newCustomerId })
        .eq("id", submittal.id);

      if (error) throw error;

      toast.success("Quote successfully reassigned to new customer!");
      setShowReassignModal(false);
      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      toast.error("Failed to reassign quote.");
    } finally {
      setIsReassigning(false);
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
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Job / Project Name</label>
              <input 
                value={formData.job_name}
                onChange={(e) => setFormData({...formData, job_name: e.target.value})}
                className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-bold text-zinc-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Display Job # (Mask)</label>
              <input 
                value={formData.quote_number_mask}
                onChange={(e) => setFormData({...formData, quote_number_mask: e.target.value})}
                placeholder={submittal.quote_number}
                className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-blue-500 rounded-xl font-bold text-zinc-900 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-800">Customer Details</h3>
                <p className="text-xs text-amber-600 mt-1 max-w-md">
                  <strong>Warning:</strong> Edits here will change this customer's global profile. If you want to link this quote to a different person entirely, reassign it instead.
                </p>
              </div>
              <button
                onClick={() => setShowReassignModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition whitespace-nowrap"
              >
                <UserPlus size={16} /> Reassign Quote
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">First Name</label>
                <input 
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-amber-400 rounded-xl font-medium text-zinc-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Last Name</label>
                <input 
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-amber-400 rounded-xl font-medium text-zinc-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Phone Number</label>
                <input 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-amber-400 rounded-xl font-medium text-zinc-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest">Email Address</label>
                <input 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full p-3 bg-zinc-50 border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-amber-400 rounded-xl font-medium text-zinc-900 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pr-10">
          <div>
            {/* --- NEW DISPLAY LOGIC FOR MASK vs ORIGINAL --- */}
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-zinc-900">{submittal.job_name}</h1>
              {submittal.quote_number_mask ? (
                <div className="flex items-center gap-2">
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-sm font-mono font-bold flex items-center gap-1.5" title="Displayed to Customer">
                    #{submittal.quote_number_mask} 
                    <span className="text-[9px] uppercase tracking-widest opacity-60">Mask</span>
                  </span>
                  <span className="text-zinc-400 text-sm font-mono font-bold" title="Original Database ID">
                    (DB: #{submittal.quote_number})
                  </span>
                </div>
              ) : (
                <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-sm font-mono font-bold">
                  #{submittal.quote_number}
                </span>
              )}
            </div>
            
            <p className="text-zinc-500 text-sm mt-1">
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

      {/* REASSIGN MODAL */}
      {showReassignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h3 className="font-bold text-zinc-900 text-lg flex items-center gap-2">
                <UserPlus size={20} className="text-blue-600" /> Reassign Quote
              </h3>
              <button 
                onClick={() => setShowReassignModal(false)}
                className="text-zinc-400 hover:text-zinc-600 transition p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4 overflow-hidden">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search by name, email, or phone..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-[200px] border border-zinc-100 rounded-xl p-2 bg-zinc-50/50">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2 py-8">
                    <Loader2 className="animate-spin" size={24} />
                    <span className="text-xs font-bold uppercase tracking-widest">Searching...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {searchResults.map((res) => (
                      <button
                        key={res.id}
                        onClick={() => handleReassignCustomer(res.id)}
                        disabled={isReassigning}
                        className="flex flex-col items-start p-3 bg-white border border-zinc-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition disabled:opacity-50 text-left"
                      >
                        <span className="font-black text-zinc-900 text-sm">{res.full_name || 'Unknown Name'}</span>
                        <div className="flex gap-3 mt-1 text-xs text-zinc-500 font-medium">
                          {res.email && <span>{res.email}</span>}
                          {res.phone && <span>{formatPhoneNumber(res.phone)}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-400 py-8 text-sm">
                    No customers found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}