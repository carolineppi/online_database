'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import CreateSubmittalForm from './CreateSubmittalForm';

export default function NewSubmittalButton() {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <button 
        onClick={() => setShowForm(true)}
        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
      >
        <Plus size={18} /> New Entry
      </button>

      {showForm && (
        <CreateSubmittalForm onClose={() => setShowForm(false)} />
      )}
    </>
  );
}