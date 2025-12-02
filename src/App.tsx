import React, { useState } from 'react';
import { AppMode } from './types';
import LiveTranslator from './components/LiveTranslator';
import Transcriber from './components/Transcriber';
import { Mic, Globe, Sparkles, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode | null>(null);

  const renderContent = () => {
    switch (mode) {
      case AppMode.LIVE_TRANSLATOR:
        return <LiveTranslator onBack={() => setMode(null)} />;
      case AppMode.TRANSCRIBE:
        return <Transcriber onBack={() => setMode(null)} />;
      default:
        return <MainMenu onSelect={setMode} />;
    }
  };

  return (
    <div className="h-screen w-full bg-slate-100 text-slate-900 font-sans overflow-hidden">
      {renderContent()}
    </div>
  );
};

const MainMenu: React.FC<{ onSelect: (mode: AppMode) => void }> = ({ onSelect }) => {
  return (
    <div className="h-full flex flex-col overflow-y-auto bg-slate-50">

      {/* Header */}
      <div className="bg-white pb-8 pt-12 px-6 shadow-sm border-b border-slate-100">
        <div className="max-w-md mx-auto">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Sparkles className="text-indigo-600 w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-indigo-600 tracking-wider uppercase">
              Gemini 2.5 Powered
            </span>
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
            LinguaFlow AI
          </h1>

          <p className="text-slate-500 leading-relaxed">
            Next-gen voice translation and synthesis. Break language barriers with real-time AI intelligence.
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="flex-1 p-6 max-w-md mx-auto w-full space-y-4">

        <MenuCard
          title="Live Call Translator"
          description="Real-time bi-directional voice translation using Gemini Live API."
          icon={<Globe className="w-6 h-6 text-white" />}
          color="bg-blue-500"
          onClick={() => onSelect(AppMode.LIVE_TRANSLATOR)}
        />

        <MenuCard
          title="Smart Transcriber"
          description="Convert spoken audio to accurate text instantly using Flash."
          icon={<Mic className="w-6 h-6 text-white" />}
          color="bg-emerald-500"
          onClick={() => onSelect(AppMode.TRANSCRIBE)}
        />

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">
            Powered by Google Gemini 2.5 Flash Native Audio
          </p>
        </div>

      </div>
    </div>
  );
};

interface MenuCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

const MenuCard: React.FC<MenuCardProps> = ({ title, description, icon, color, onClick }) => (
  <button
    onClick={onClick}
    className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 transition-all hover:shadow-md hover:scale-[1.02] text-left group"
  >
    <div className={`${color} w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all`}>
      {icon}
    </div>

    <div className="flex-1">
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
    </div>

    <ChevronRight className="text-slate-300 group-hover:text-slate-600" />
  </button>
);

export default App;
