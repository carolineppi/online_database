'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Calendar,
  ArrowRight,
  Filter,
  Copy,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function SubmittalsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [submittals, setSubmittals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });

  useEffect(() => {
    fetchSubmittals();
  }, [dateRange]);

  const fetchSubmittals = async () => {
    setLoading(true);
    // Added 'customer' to the select string to ensure we have the ID for duplication
    const { data, error } = await supabase
      .from('quote_submittals')
      .select(`
        id,
        created_at,
        job_name,
        quote_number,
        status,
        is_hardware_included,
        customer,
        campaign_source,
        shipping_address,
        description,
        customers (
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .is('deleted_at', null)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSubmittals(data);
    }
    setLoading(false);
  };

  const handleDuplicate = async (e: React.MouseEvent, submittal: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Duplicate this submittal and its pricing options?")) return;

    setDuplicatingId(submittal.id);
    
    try {
      // 1. Get employee name_code
      const { data: { user } } = await supabase.auth.getUser();
      let nameCode = 'XX';
      if (user?.email) {
        const { data: emp } = await supabase.from('employees').select('name_code').eq('email', user.email).single();
        if (emp?.name_code) nameCode = emp.name_code.toUpperCase();
      }

      // 2. Generate secure quote number
      const { data: newQuoteNumber, error: rpcError } = await supabase.rpc('generate_quote_number', { name_code: nameCode });
      if (rpcError) throw rpcError;

      // 3. Duplicate Quote Submittal Parent
      const { data: newSubmittal, error: subError } = await supabase
        .from('quote_submittals')
        .insert({
          job_name: 'Edit Name Here',
          quote_number: newQuoteNumber,
          customer: submittal.customer, 
          quote_source: 'Duplicate',
          campaign_source: submittal.campaign_source,
          shipping_address: submittal.shipping_address,
          description: submittal.description,
          is_hardware_included: submittal.is_hardware_included,
          status: 'PENDING'
        })
        .select()
        .single();

      if (subError) throw subError;

      // 4. Fetch and Duplicate Individual Quotes (Options)
      const { data: options } = await supabase
        .from('individual_quotes')
        .select('*')
        .eq('quote_id', submittal.id)
        .is('deleted_at', null);

      if (options && options.length > 0) {
        const newOptions = options.map((opt: any) => ({
          quote_id: newSubmittal.id,
          material: opt.material,
          mounting_style: opt.mounting_style,
          quantity: opt.quantity,
          color: opt.color,
          price: opt.price,
          manufacturer: opt.manufacturer,
          shipping_area: opt.shipping_area,
          shipping_included: opt.shipping_included,
          hardware_included: opt.hardware_included,
          itemized_breakdown: opt.itemized_breakdown,
          details: opt.details,
          estimated_cost: opt.estimated_cost
        }));
        
        await supabase.from('individual_quotes').insert(newOptions);
      }

      toast.success("Submittal duplicated successfully!");
      router.push(`/submittals/${newSubmittal.id}`);
      
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate submittal");
      setDuplicatingId(null);
    }
  };

  const filteredSubmittals = submittals.filter(sub => {
    const matchesSearch = 
      sub.job_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.quote_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.customers?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.customers?.last_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || sub.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'WON': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'LOST': return <XCircle size={14} className="text-red-500" />;
      default: return <Clock size={14} className="text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WON': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'LOST': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto bg-zinc-50 min-h-screen">
      
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Quote Submittals</h1>
          <p className="text-zinc-500 text-sm">Manage all incoming quote requests and pipeline.</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center w-full md:w-auto gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              type="text" 
              placeholder="Search quotes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none ring-1 ring-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-medium"
            />
          </div>
          
          <div className="flex items-center gap-2 bg-zinc-50 px-3 py-2 rounded-xl ring-1 ring-zinc-200">
            <Filter size={14} className="text-zinc-400" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-zinc-700 outline-none cursor-pointer p-0 pr-4"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-zinc-50 p-2 rounded-xl ring-1 ring-zinc-200">
          <Calendar size={16} className="text-zinc-400 ml-2" />
          <input 
            type="date" 
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            className="text-sm font-bold bg-transparent border-none p-1 outline-none cursor-pointer text-zinc-700"
          />
          <ArrowRight size={14} className="text-zinc-300" />
          <input 
            type="date" 
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            className="text-sm font-bold bg-transparent border-none p-1 outline-none cursor-pointer text-zinc-700"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Job Info</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">Loading submittals...</td>
                </tr>
              ) : filteredSubmittals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 font-medium">No submittals found matching your filters.</td>
                </tr>
              ) : (
                filteredSubmittals.map((submittal) => (
                  <tr key={submittal.id} className="hover:bg-zinc-50 transition group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 flex items-center gap-2">
                        <FileText size={16} className="text-blue-500" />
                        {submittal.job_name || 'Untitled Project'}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1 flex gap-2">
                        <span>#{submittal.quote_number}</span>
                        <span>•</span>
                        <span>{new Date(submittal.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-800">
                        {submittal.customers?.first_name} {submittal.customers?.last_name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {submittal.customers?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusBadge(submittal.status)}`}>
                        {getStatusIcon(submittal.status)} {submittal.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Duplicate Button */}
                        <button 
                          onClick={(e) => handleDuplicate(e, submittal)}
                          disabled={duplicatingId === submittal.id}
                          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition disabled:opacity-50"
                          title="Duplicate Submittal"
                        >
                          {duplicatingId === submittal.id ? <Loader2 size={20} className="animate-spin" /> : <Copy size={20} />}
                        </button>

                        <Link 
                          href={`/submittals/${submittal.id}`}
                          className="text-zinc-400 hover:text-zinc-900 font-bold text-xs uppercase tracking-widest transition"
                        >
                          View &rarr;
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}