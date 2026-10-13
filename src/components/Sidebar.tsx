import React from 'react';
import {
  LayoutDashboard,
  Settings,
  Cpu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

export type NavTab = 'dashboard' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  collapsed,
  setCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const { products } = useInventory();

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; badge?: string }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 text-[#00FF66]" />,
      badge: products.length > 0 ? String(products.length) : undefined,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4 text-[#00FF66]" />,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0D1013] border-r border-[#1B2228] transition-all duration-200 select-none ${
          collapsed ? 'w-18' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#1B2228]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#141A1F] border border-[#00FF66]/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,255,102,0.2)]">
              <Cpu className="w-4 h-4 text-[#00FF66]" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-display font-bold text-sm tracking-wider text-white flex items-center gap-1.5">
                  DDLC AI
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
                    REV 2.1
                  </span>
                </span>
                <span className="text-[10px] text-gray-400 font-mono truncate">
                  Inventory & Projects
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-6 h-6 rounded items-center justify-center text-gray-400 hover:text-white hover:bg-[#182026] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          <div className={`px-2 mb-2 text-[10px] font-mono tracking-widest uppercase text-gray-400 ${collapsed ? 'text-center' : ''}`}>
            {collapsed ? '•' : 'SYSTEM NAV'}
          </div>

          {navItems.map((item) => {
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                  active
                    ? 'bg-[#151D22] text-[#00FF66] border border-[#00FF66]/30 shadow-[0_0_12px_rgba(0,255,102,0.1)]'
                    : 'text-gray-300 hover:text-white hover:bg-[#13181C] border border-transparent'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className={active ? 'text-[#00FF66]' : 'text-gray-400 group-hover:text-gray-200'}>
                  {item.icon}
                </span>

                {!collapsed && (
                  <span className="truncate flex-1 text-left font-sans">
                    {item.label}
                  </span>
                )}

                {!collapsed && item.badge && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#00FF66]/20 text-[#00FF66] font-semibold border border-[#00FF66]/40">
                    {item.badge}
                  </span>
                )}

                {active && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#00FF66] rounded-r-full shadow-[0_0_6px_#00FF66]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hardware Status */}
        <div className="p-3 border-t border-[#1B2228] bg-[#0A0D0F]">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="p-2 rounded bg-[#11161A] border border-[#1C252C] text-[11px] font-mono">
                <div className="flex items-center justify-between text-gray-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] neon-dot animate-pulse" />
                    STATUS: READY
                  </span>
                  <span className="text-[#00FF66]">DIRECT</span>
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  SYS: DDLC-HW-MK1 • FIRESTORE
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00FF66] neon-dot" title="Hardware Active" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
