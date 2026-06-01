"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function SubmittalsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [submittals, setSubmittals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastDay = today.toISOString().split("T")[0];
  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });

  // 1. Debounce Effect: Triggers automatically when Search, Dates, or Status change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSubmittals();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, dateRange, statusFilter]);

  const fetchSubmittals = async () => {
    setLoading(true);

    let request = supabase
      .from("quote_submittals")
      .select(
        `
        id,
        created_at,
        job_name,
        quote_number,
        quote_number_mask,
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
      `,
      )
      .is("deleted_at", null);

    // Apply Status Filter directly to the database request
    if (statusFilter !== "ALL") {
      request = request.eq("status", statusFilter);
    }

    // 2. Search vs Date Logic
    if (searchQuery.trim().length > 0) {
      // MODE 1: Search Whole Database (Unbound by date)
      const query = searchQuery.trim().replace(/,/g, ""); // Strip commas for safe DB queries

      // Look up matching customers first (since Supabase OR doesn't cross tables easily)
      const { data: matchedCustomers } = await supabase
        .from("customers")
        .select("id")
        .or(
          `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`,
        );

      const customerIds = matchedCustomers?.map((c) => c.id) || [];

      // Search job names, quote numbers, and our newly added quote mask!
      let orString = `job_name.ilike.%${query}%,quote_number.ilike.%${query}%,quote_number_mask.ilike.%${query}%`;

      if (customerIds.length > 0) {
        orString += `,customer.in.(${customerIds.join(",")})`;
      }

      // Limit to 100 to prevent crashing the browser if they search something broad like "The"
      request = request.or(orString).limit(100);
    } else {
      // MODE 2: Browse by Date Range
      request = request
        .gte("created_at", `${dateRange.start}T00:00:00`)
        .lte("created_at", `${dateRange.end}T23:59:59`);
    }

    request = request.order("created_at", { ascending: false });

    const { data, error } = await request;

    if (!error && data) {
      setSubmittals(data);
    } else if (error) {
      console.error(error);
      toast.error("Failed to load submittals");
    }
    setLoading(false);
  };

  const handleDuplicate = async (e: React.MouseEvent, submittal: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Duplicate this submittal and its pricing options?")) return;

    setDuplicatingId(submittal.id);

    try {
      // 1. Get the current user's initials for the mask
      const savedEmployee = localStorage.getItem("employee");
      const employee = savedEmployee ? JSON.parse(savedEmployee) : null;
      const nameCode = employee?.name_code || "XX";

      // 2. Generate the Secure Quote Number manually to stay in sync
      const now = new Date();
      const yearSuffix = now.getFullYear().toString().slice(-2);

      const { data: lastQuote } = await supabase
        .from("quote_submittals")
        .select("quote_number")
        .ilike("quote_number", `${yearSuffix}-%`)
        .order("quote_number", { ascending: false })
        .limit(1)
        .single();

      let nextSequence = 1;
      if (lastQuote?.quote_number) {
        const parts = lastQuote.quote_number.split("-");
        if (parts.length > 1) {
          const numericMatch = parts[1].match(/^\d{4}/);
          if (numericMatch) nextSequence = parseInt(numericMatch[0]) + 1;
        }
      }

      const paddedSeq = nextSequence.toString().padStart(4, "0");
      const finalQuoteNumber = `${yearSuffix}-${paddedSeq}`;
      const finalQuoteMask = `${finalQuoteNumber}${nameCode}`;

      // 3. Create the duplicate Submittal record
      const { data: newSubmittal, error: subError } = await supabase
        .from("quote_submittals")
        .insert({
          job_name: submittal.job_name + " (Copy)",
          quote_number: finalQuoteNumber,
          quote_number_mask: finalQuoteMask,
          customer: submittal.customer,
          quote_source: "Duplicate",
          campaign_source: submittal.campaign_source,
          shipping_address: submittal.shipping_address,
          description: submittal.description,
          is_hardware_included: submittal.is_hardware_included,
          status: "PENDING",
        })
        .select()
        .single();

      if (subError) throw subError;

      // 4. Copy over the individual options
      const { data: options } = await supabase
        .from("individual_quotes")
        .select("*")
        .eq("quote_id", submittal.id)
        .is("deleted_at", null);

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
          estimated_cost: opt.estimated_cost,
        }));

        await supabase.from("individual_quotes").insert(newOptions);
      }

      toast.success("Submittal duplicated successfully!");
      router.push(`/submittals/${newSubmittal.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate submittal");
      setDuplicatingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    const s = status?.toUpperCase() || "PENDING";
    switch (s) {
      case "WON":
        return <CheckCircle size={14} className="text-emerald-500" />;
      case "QUOTED":
        return <Clock size={14} className="text-amber-500" />;
      case "PENDING":
        return <Clock size={14} className="text-red-500" />;
      default:
        return <Clock size={14} className="text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase() || "PENDING";
    switch (s) {
      case "WON":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "QUOTED":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "PENDING":
        return "bg-red-50 text-red-700 border-red-100";
      default:
        return "bg-red-50 text-red-700 border-red-100";
    }
  };

  return (
    <main className="pl-64 min-h-screen bg-gray-50">
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Quote Submittals</h1>
          <p className="text-zinc-500 text-sm">
            Manage all incoming quote requests and pipeline.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center w-full md:w-auto gap-3">
          <div className="relative w-full md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              size={16}
            />
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
              <option value="QUOTED">Quoted</option>
              <option value="WON">Won</option>
            </select>
          </div>
        </div>

        {/* 3. Dynamic styling to show when Date filters are overridden by Search */}
        <div
          className={`flex items-center gap-2 p-2 rounded-xl ring-1 transition duration-300 ${
            searchQuery.trim()
              ? "bg-zinc-100 ring-zinc-200 opacity-50 pointer-events-none"
              : "bg-zinc-50 ring-zinc-200"
          }`}
          title={
            searchQuery.trim() ? "Date filter is disabled while searching" : ""
          }
        >
          <Calendar size={16} className="text-zinc-400 ml-2" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) =>
              setDateRange({ ...dateRange, start: e.target.value })
            }
            className="text-sm font-bold bg-transparent border-none p-1 outline-none cursor-pointer text-zinc-700"
          />
          <ArrowRight size={14} className="text-zinc-300" />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) =>
              setDateRange({ ...dateRange, end: e.target.value })
            }
            className="text-sm font-bold bg-transparent border-none p-1 outline-none cursor-pointer text-zinc-700"
          />
        </div>
      </div>

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
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-zinc-400"
                  >
                    Loading submittals...
                  </td>
                </tr>
              ) : submittals.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-zinc-400 font-medium"
                  >
                    No submittals found matching your filters.
                  </td>
                </tr>
              ) : (
                submittals.map((submittal) => (
                  <tr
                    key={submittal.id}
                    className="hover:bg-zinc-50 transition group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 flex items-center gap-2">
                        <FileText size={16} className="text-blue-500" />
                        {submittal.job_name || "Untitled Project"}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1 flex gap-2">
                        {/* We pull in the Mask you added earlier! */}
                        <span>
                          #
                          {submittal.quote_number_mask ||
                            submittal.quote_number}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(submittal.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-800">
                        {submittal.customers?.first_name}{" "}
                        {submittal.customers?.last_name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {submittal.customers?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusBadge(submittal.status)}`}
                      >
                        {getStatusIcon(submittal.status)}{" "}
                        {submittal.status || "PENDING"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleDuplicate(e, submittal)}
                          disabled={duplicatingId === submittal.id}
                          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition disabled:opacity-50"
                          title="Copy Quote"
                        >
                          {duplicatingId === submittal.id ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : (
                            <Copy size={20} />
                          )}
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
    </main>
  );
}