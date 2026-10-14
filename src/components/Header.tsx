import React, { useState } from 'react';
import {
  Menu,
  Search,
  ScanLine,
  Sparkles,
  Boxes,
  Plus,
  X,
  Bell,
  User,
  ExternalLink,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';
import { Product } from '../types';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenAi: () => void;
  onOpenScanner: () => void;
  onOpenAddItem: () => void;
  onSelectItem?: (product: Product) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenAi,
  onOpenScanner,
  onOpenAddItem,
  onSelectItem,
}) => {
  const { products } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const searchResults = searchQuery.trim()
    ? products
        .filter((p) => {
          const q = searchQuery.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            (p.storageLocation || '').toLowerCase().includes(q) ||
            (p.barcode || '').toLowerCase().includes(q)
          );
        })
        .slice(0, 6)
    : [];

  const lowStockCount = products.filter((p) => !p.archived && p.quantity <= 5).length;

  return (
    <header className="h-16 bg-white border-b border-[#E6EDE7] px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Zone 1: Brand & Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-[#77857C] hover:text-[#174D35] hover:bg-[#F0F9F2] transition-colors cursor-pointer"
          title="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center font-bold text-sm shadow-xs border border-[#CDE3D2]">
            <Boxes className="w-5 h-5 text-[#168653]" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#174D35] leading-tight flex items-center gap-1.5">
              <span>DDLC AI</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#CDE3D2] hidden sm:inline-block">
                Inventory
              </span>
            </div>
            <div className="text-[11px] text-[#77857C] hidden sm:block font-medium">
              Electronics Lab System
            </div>
          </div>
        </div>
      </div>

      {/* Zone 2: Global Search in the Center */}
      <div className="relative flex-1 max-w-md mx-3 lg:mx-8 hidden sm:block">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#77857C] absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            placeholder="Search parts, SKUs (DDLC-...), bins or specs..."
            className="w-full pl-10 pr-9 py-2 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-xs text-[#25352C] placeholder-[#77857C] focus:outline-none focus:border-[#168653] focus:bg-white transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-[#77857C] hover:text-[#25352C] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Live Search Quick Popover */}
        {isSearchFocused && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E6EDE7] rounded-2xl shadow-xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-[#77857C]">
              Matching Components ({searchResults.length})
            </div>
            {searchResults.map((p) => (
              <div
                key={p.id}
                onMouseDown={() => {
                  if (onSelectItem) onSelectItem(p);
                  setSearchQuery('');
                }}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F0F9F2] cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#E5F5E9] text-[#168653] flex items-center justify-center shrink-0">
                    <Boxes className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#25352C] group-hover:text-[#168653] truncate">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-[#77857C] font-mono">
                      {p.sku} • {p.storageLocation || 'Workbench'}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-xs font-bold text-[#174D35]">
                    {p.quantity} {p.unit || 'pcs'}
                  </div>
                  <div className="text-[10px] text-[#77857C]">
                    {formatINR(p.unitPrice)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zone 3: Notification & Profile Control */}
      <div className="flex items-center gap-2.5">
        {/* Quick Header Scan Button */}
        <button
          onClick={onOpenScanner}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F9F6] hover:bg-[#E5F5E9] border border-[#E6EDE7] text-[#174D35] text-xs font-semibold transition-all cursor-pointer"
          title="Open Barcode Scanner"
        >
          <ScanLine className="w-3.5 h-3.5 text-[#168653]" />
          <span>Scan</span>
        </button>

        {/* Quick Header AI Button */}
        <button
          onClick={onOpenAi}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E5F5E9] hover:bg-[#d8eedd] text-[#168653] text-xs font-semibold transition-all cursor-pointer"
          title="Ask DDLC AI"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#168653]" />
          <span>Ask AI</span>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-xl text-[#77857C] hover:text-[#174D35] hover:bg-[#F5F9F6] transition-colors relative cursor-pointer"
            title="Lab Notifications"
          >
            <Bell className="w-4 h-4" />
            {lowStockCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E6EDE7] rounded-2xl shadow-xl p-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-[#E6EDE7] mb-2 font-bold text-[#174D35]">
                <span>Notifications</span>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[#77857C] hover:text-[#25352C] p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {lowStockCount > 0 ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <span>⚠️ Low Stock Alert</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    {lowStockCount} components are running low (≤ 5 units). Check Low Stock section on your dashboard.
                  </p>
                </div>
              ) : (
                <div className="py-4 text-center text-[#77857C]">
                  All inventory levels are healthy!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Pill Control (Afkar) */}
        <div className="flex items-center gap-2 pl-1 border-l border-[#E6EDE7]">
          <div className="w-8 h-8 rounded-full bg-[#E5F5E9] text-[#168653] font-bold text-xs flex items-center justify-center border border-[#CDE3D2] shadow-2xs">
            A
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-[#174D35] leading-none">Afkar</div>
            <div className="text-[10px] text-[#77857C] font-medium leading-none mt-0.5">Lab Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
};
