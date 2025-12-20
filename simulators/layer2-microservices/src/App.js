import React, { useState } from 'react';
import MicroservicesSimulator from './components/MicroservicesSimulator';
import ContextRefinery from './components/ContextRefinery';

function App() {
  const [view, setView] = useState('refinery'); // Default to new view

  return (
    <div>
      {/* Global Navigation Bar */}
      <nav className="bg-slate-900 text-white p-3 border-b border-slate-700 flex gap-4 text-sm font-mono">
        <button 
          onClick={() => setView('simulator')}
          className={`px-3 py-1 rounded ${view === 'simulator' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}
        >
          LAYER 2: Legacy Simulator
        </button>
        <button 
          onClick={() => setView('refinery')}
          className={`px-3 py-1 rounded ${view === 'refinery' ? 'bg-teal-600' : 'hover:bg-slate-800'}`}
        >
          LAYER 6: Context Refinery (New)
        </button>
      </nav>

      {/* View Switcher */}
      {view === 'simulator' ? <MicroservicesSimulator /> : <ContextRefinery />}
    </div>
  );
}

export default App;
