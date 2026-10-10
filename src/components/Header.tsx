import React, { useState, useEffect } from 'react';
import { Menu, Plus, Sparkles, Activity, Database, Clock, IndianRupee } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenAi: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenAi,
}) => {
  const { products, purchases, projects, totalPurchasesValue } = useInventory();
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-[#0B0E11]/90 backdrop-blur-md border-b border-[#1A2127] px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Mobile Menu trigger & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg bg-[#141A20] text-gray-300 hover:text-white border border-[#232C33]"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00FF66] neon-dot hidden sm:inline-block" />
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
              <span className="font-display font-bold text-[#00FF66]">DDLC AI</span>
              <span className="text-gray-400 font-normal hidden sm:inline">|</span>
              <span className="text-xs text-gray-300 font-mono hidden sm:inline">
                INVENTORY & PROJECT CONTROL
              </span>
            </h1>
          </div>
        </div>
      </div>

      {/* Hardware Telemetry readout */}
      <div className="hidden md:flex items-center gap-4 text-[11px] font-mono text-gray-400 border-x border-[#1A2127] px-4">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-300">{timeStr || '00:00:00'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-[#00FF66]" />
          <span>ITEMS:</span>
          <span className="text-white font-semibold">
            {products.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>PURCHASES:</span>
          <span className="text-white font-semibold">{purchases.length} POs</span>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#122216] border border-[#00FF66]/30">
          <span className="text-[#00FF66] font-bold">TOTAL COST:</span>
          <span className="text-white font-semibold font-mono text-emerald-300">
            {formatINR(totalPurchasesValue)}
          </span>
        </div>
      </div>

      {/* Unified AI Action Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenAi}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-bold text-xs transition-all shadow-[0_0_15px_rgba(0,255,102,0.3)] cursor-pointer active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 fill-black" />
          <span>DDLC AI</span>
        </button>
      </div>
    </header>
  );
};
