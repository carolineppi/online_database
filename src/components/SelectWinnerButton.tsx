'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SelectWinnerProps {
  quoteId: string;
  optionId: string;
  price: number;
}

export default function SelectWinnerButton({ quoteId, optionId, price }: SelectWinnerProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConvert = async () => {
  if (!confirm("Are you sure? This will lock the submittal and create a live Job.")) return;

  setLoading(true);
  try {
    const res = await fetch('/api/convert-to-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId, optionId, price }),
    });

    const data = await res.json();

    if (data.success) {
      toast.success("Quote converted to Job successfully!");
      // Refresh FIRST to clear cache, then move to the jobs page
      router.refresh(); 
      router.push('/jobs'); 
    } else {
      toast.error(data.error);
    }
  } catch (err) {
    toast.error("Failed to connect to the server.");
  } finally {
    setLoading(false);
  }
};

  return (
    <button
      onClick={handleConvert}
      disabled={loading}
      className="flex items-center gap-2 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-bold hover:bg-green-100 transition disabled:opacity-50"
    >
      <CheckCircle size={14} />
      {loading ? 'Converting...' : 'Select as Winner'}
    </button>
  );
}