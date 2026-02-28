'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import AddOptionModal from './AddOptionModal';

export default function AddOptionTrigger({ quoteId }: { quoteId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="text-sm bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition flex items-center gap-2"
      >
        <Plus size={16} /> Add Material Option
      </button>

      {isOpen && <AddOptionModal quoteId={quoteId} onClose={() => setIsOpen(false)} />}
    </>
  );
}