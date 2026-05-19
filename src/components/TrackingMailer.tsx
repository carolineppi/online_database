"use client";

import { useState, useEffect } from "react";
import { Truck, X, Search, Navigation, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export default function TrackingMailer({
  job,
  onClose,
}: {
  job: any;
  onClose: () => void;
}) {
  const [customerEmail, setCustomerEmail] = useState("");
  const [additionalEmail, setAdditionalEmail] = useState(""); // NEW STATE
  const [poNumber] = useState(job.quote_submittals?.quote_number || "");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [freightWebsite, setFreightWebsite] = useState("");
  const [freightPhone, setFreightPhone] = useState("");
  const [optOutReview, setOptOutReview] = useState(false); // NEW STATE
  const [reviewSettings, setReviewSettings] = useState({
    delay_days: 7,
    cooldown_days: 30,
  }); // NEW STATE

  const [isLoading, setIsLoading] = useState(false);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    const fetchCustomerInfo = async () => {
      const customerId = job.quote_submittals?.customer;
      if (!customerId) return;
      const { data } = await supabase
        .from("customers")
        .select("email")
        .eq("id", customerId)
        .single();
      if (data) setCustomerEmail(data.email);
    };

    const fetchCarriers = async () => {
      const { data } = await supabase
        .from("carriers")
        .select("*")
        .order("name");
      if (data) setCarriers(data);
    };

    const fetchRecent = async () => {
      const { data, error } = await supabase
        .from("tracking_mailer")
        .select(
          `
          id, created_at, tracking_number,
          jobs ( quote_submittals ( quote_number, quote_number_mask, customers!customer ( email ) ) )
        `,
        ) // <-- Added quote_number_mask here
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setRecentSubmissions(data);
    };

    // NEW: Fetch the global review settings
    const fetchReviewSettings = async () => {
      const { data } = await supabase
        .from("review_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (data) setReviewSettings(data);
    };

    fetchCustomerInfo();
    fetchCarriers();
    fetchRecent();
    fetchReviewSettings();
  }, [job, supabase]);

  const setCarrierInfo = (site: string, phone: string) => {
    setFreightWebsite(site);
    setFreightPhone(phone);
  };

  const handleSendTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. ATTEMPT TO SEND EMAIL FIRST
      const res = await fetch("/api/send-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_email: customerEmail,
          additional_email: additionalEmail, // NEW: Pass the additional email
          po_number: poNumber,
          display_job_number: job.quote_submittals?.quote_number_mask || "",
          tracking_number: trackingNumber,
          freight_website: freightWebsite,
          freight_phone: freightPhone,
        }),
      });

      const responseData = await res.json();
      if (!res.ok)
        throw new Error(
          responseData.error || "Failed to dispatch email via SMTP",
        );

      // 2. IF EMAIL SUCCEEDS, SAVE TO TRACKING DATABASE
      const { error: dbError } = await supabase.from("tracking_mailer").insert({
        job_id: job.id,
        tracking_number: trackingNumber,
        freight_website: freightWebsite,
        freight_phone: freightPhone,
      });

      if (dbError)
        throw new Error(
          "Email sent, but failed to log to database: " + dbError.message,
        );

      // 3. NEW: SCHEDULE THE REVIEW EMAIL (IF NOT OPTED OUT)
      if (!optOutReview) {
        // Check for spam cooldown
        const cooldownDate = new Date();
        cooldownDate.setDate(
          cooldownDate.getDate() - reviewSettings.cooldown_days,
        );

        const { data: recentReview } = await supabase
          .from("review_emails")
          .select("id")
          .eq("customer_email", customerEmail)
          .gte("created_at", cooldownDate.toISOString())
          .limit(1);

        let finalStatus = "pending";
        if (recentReview && recentReview.length > 0) {
          finalStatus = "skipped_spam"; // Flag it as skipped so it doesn't send, but we have a record
        }

        // Calculate Midday X days from now
        const scheduleDate = new Date();
        scheduleDate.setDate(
          scheduleDate.getDate() + reviewSettings.delay_days,
        );
        scheduleDate.setHours(12, 0, 0, 0); // Noon

        await supabase.from("review_emails").insert({
          job_id: job.id,
          customer_email: customerEmail,
          scheduled_for: scheduleDate.toISOString(),
          status: finalStatus,
        });
      }

      toast.success("Tracking email dispatched & Review rules processed!");

      setRecentSubmissions((prev) => [
        {
          id: Math.random(),
          created_at: new Date().toISOString(),
          tracking_number: trackingNumber,
          jobs: {
            quote_submittals: {
              quote_number: poNumber,
              quote_number_mask: job.quote_submittals?.quote_number_mask || "", // <-- Added this line
              customers: { email: customerEmail },
            },
          },
        },
        ...prev,
      ]);

      setTrackingNumber("");
      setFreightWebsite("");
      setFreightPhone("");
      setAdditionalEmail(""); // NEW: Clear after sending
      setOptOutReview(false);
    } catch (err: any) {
      console.error("Tracking Error:", err);
      toast.error(err.message || "Failed to send tracking info.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-y-auto max-h-[90vh] shadow-2xl">
        <form onSubmit={handleSendTracking} className="p-10">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-black text-zinc-900 uppercase flex items-center gap-3">
                <Truck className="text-emerald-600" size={28} />
                Dispatch Tracking
              </h2>
              <p className="text-zinc-500 font-medium ml-10 mt-1">
                {job.quote_submittals?.job_name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 transition"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN: Inputs */}
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">
                  Customer Email
                </label>
                <input
                  disabled
                  type="email"
                  value={customerEmail}
                  className="w-full p-4 bg-zinc-100 rounded-2xl border-none text-zinc-500 font-bold cursor-not-allowed"
                />
              </div>

              {/* NEW: Additional Email Field */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">
                  Additional Email (Optional)
                </label>
                <input
                  type="email"
                  value={additionalEmail}
                  onChange={(e) => setAdditionalEmail(e.target.value)}
                  placeholder="cc@example.com"
                  className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">
                  PO Number
                </label>
                <input
                  disabled
                  type="text"
                  value={job.quote_submittals?.quote_number_mask || poNumber}
                  title={`Original PO: ${poNumber}`}
                  className="w-full p-4 bg-zinc-100 rounded-2xl border-none text-zinc-500 font-bold cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">
                  PRO / Tracking #
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                    size={18}
                  />
                  <input
                    required
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Tracking Number"
                    className="w-full p-4 pl-12 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition font-bold"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Carriers Grid */}
            <div className="lg:col-span-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest mb-2 block">
                Quick Select Carrier
              </label>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {carriers.map((carrier) => (
                  <button
                    key={carrier.name}
                    type="button"
                    onClick={() => setCarrierInfo(carrier.site, carrier.phone)}
                    className="bg-white border border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50 text-zinc-600 hover:text-emerald-700 text-xs font-bold py-3 px-2 rounded-xl transition-all active:scale-95 shadow-sm"
                  >
                    {carrier.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">
                    Carrier Website
                  </label>
                  <div className="relative">
                    <Navigation
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                      size={16}
                    />
                    <input
                      required
                      type="text"
                      value={freightWebsite}
                      onChange={(e) => setFreightWebsite(e.target.value)}
                      placeholder="URL"
                      className="w-full p-4 pl-10 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition text-sm font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase ml-2 tracking-widest">
                    Carrier Phone
                  </label>
                  <input
                    type="text"
                    value={freightPhone}
                    onChange={(e) => setFreightPhone(e.target.value)}
                    placeholder="Phone"
                    className="w-full p-4 bg-zinc-50 rounded-2xl border-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-emerald-500 transition text-sm font-medium"
                  />
                </div>
              </div>

              {/* NEW: Review Opt-Out Checkbox */}
              <div
                className="mt-6 bg-red-50/50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 cursor-pointer"
                onClick={() => setOptOutReview(!optOutReview)}
              >
                <input
                  type="checkbox"
                  checked={optOutReview}
                  onChange={(e) => setOptOutReview(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <label className="text-sm font-bold text-red-900 cursor-pointer flex items-center gap-2">
                    <AlertTriangle size={14} /> Opt-Out of Google Review Request
                  </label>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mt-1">
                    Check this box if you suspect this customer may leave a
                    negative review. The automated email scheduled for{" "}
                    {reviewSettings.delay_days} days from now will be cancelled.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-10 border-b border-zinc-100 pb-10">
            <button
              type="button"
              onClick={() => {
                setFreightWebsite("");
                setFreightPhone("");
                setAdditionalEmail("");
                setOptOutReview(false);
              }}
              className="flex-1 p-5 rounded-2xl font-black text-zinc-500 hover:bg-zinc-100 transition uppercase tracking-widest text-[10px]"
            >
              Clear Form
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-[2] p-5 bg-zinc-900 text-white rounded-2xl font-black hover:bg-emerald-600 transition uppercase tracking-widest text-[10px] shadow-xl shadow-zinc-200 disabled:opacity-50"
            >
              {isLoading ? "Dispatching..." : "Send Tracking & Schedule Review"}
            </button>
          </div>

          {/* Recent Submissions */}
          <div className="mt-8">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
              Recent Dispatches
            </h3>
            {recentSubmissions.length > 0 ? (
              <div className="bg-zinc-50 rounded-3xl border border-zinc-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">PO Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {recentSubmissions.map((sub: any) => {
                      const derivedEmail =
                        sub.jobs?.quote_submittals?.customers?.email ||
                        "Unknown";
                      // NEW LOGIC: Try mask first, then fallback to original, then fallback to 'Unknown'
                      const submittalData = sub.jobs?.quote_submittals;
                      const derivedPo =
                        submittalData?.quote_number_mask ||
                        submittalData?.quote_number ||
                        "Unknown";

                      return (
                        <tr key={sub.id}>
                          <td className="px-6 py-3 text-zinc-500 font-medium">
                            {new Date(sub.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3 font-bold text-zinc-800">
                            {derivedEmail}
                          </td>
                          <td className="px-6 py-3 text-zinc-600 font-mono">
                            #{derivedPo}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 italic">
                No recent tracking emails sent.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
