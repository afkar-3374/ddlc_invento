import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  FolderGit2,
  Receipt,
  FileSpreadsheet,
  Settings,
  ScanLine,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Building2,
  Download,
  Tag,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

export type NavTab =
  | 'dashboard'
  | 'inventory'
  | 'projects'
  | 'purchases'
  | 'reports'
  | 'settings'
  | 'scanner'
  | 'vendors'
  | 'studio'
  | 'ai';

interface SidebarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  onOpenScanner?: () => void;
  onOpenInstall?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  collapsed,
  setCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  onOpenInstall,
}) => {
  const { products, projects, purchases, vendors } = useInventory();
  const { isInstalled } = usePWAInstall();

  // Desktop sidebar items as explicitly required:
  // 1. Dashboard, 2. Inventory, 3. Projects, 4. Purchases, 5. Reports, 6. Settings
  const primaryNavItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: <Boxes className="w-4 h-4" />,
      badge: products.length > 0 ? String(products.length) : undefined,
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: <FolderGit2 className="w-4 h-4" />,
      badge: projects.length > 0 ? String(projects.length) : undefined,
    },
    {
      id: 'purchases',
      label: 'Purchases',
      icon: <Receipt className="w-4 h-4" />,
      badge: purchases.length > 0 ? String(purchases.length) : undefined,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <FileSpreadsheet className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  // Secondary tools (Suppliers, Scanner, AI)
  const secondaryNavItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'scanner',
      label: 'Barcode Scanner',
      icon: <ScanLine className="w-4 h-4" />,
    },
    {
      id: 'vendors',
      label: 'Suppliers & Vendors',
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      id: 'studio',
      label: 'Label Studio',
      icon: <Tag className="w-4 h-4" />,
    },
    {
      id: 'ai',
      label: 'DDLC AI Assistant',
      icon: <Sparkles className="w-4 h-4" />,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-2xs transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-[#E6EDE7] shadow-xs transition-all duration-200 select-none ${
          collapsed ? 'w-18' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#E6EDE7] bg-white">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-2xl bg-[#E5F5E9] border border-[#CDE3D2] flex items-center justify-center shrink-0 shadow-xs text-[#168653]">
              <Boxes className="w-5 h-5 text-[#168653]" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm tracking-tight text-[#174D35] flex items-center gap-1.5">
                  DDLC AI
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#CDE3D2]">
                    v2.5
                  </span>
                </span>
                <span className="text-[11px] text-[#77857C] font-medium truncate">
                  Lab & Inventory System
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-7 h-7 rounded-xl items-center justify-center text-[#77857C] hover:text-[#174D35] hover:bg-[#F5F9F6] transition-colors cursor-pointer"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Primary Navigation items */}
        <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {!collapsed && (
            <div className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-[#77857C]">
              Navigation
            </div>
          )}

          {primaryNavItems.map((item) => {
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all group relative cursor-pointer ${
                  active
                    ? 'bg-[#E5F5E9] text-[#174D35] shadow-xs font-bold'
                    : 'text-[#77857C] hover:text-[#174D35] hover:bg-[#F5F9F6]'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`${active ? 'text-[#168653]' : 'text-[#77857C] group-hover:text-[#174D35]'}`}>
                  {item.icon}
                </span>

                {!collapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}

                {!collapsed && item.badge && (
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      active
                        ? 'bg-white text-[#168653] border border-[#CDE3D2]'
                        : 'bg-[#F5F9F6] text-[#77857C] border border-[#E6EDE7]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Secondary Tools Section */}
          <div className="pt-4 mt-4 border-t border-[#E6EDE7]">
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-[#77857C]">
                Lab Tools
              </div>
            )}
            {secondaryNavItems.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all group relative cursor-pointer ${
                    active
                      ? 'bg-[#E5F5E9] text-[#174D35] shadow-xs font-bold'
                      : 'text-[#77857C] hover:text-[#174D35] hover:bg-[#F5F9F6]'
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={`${active ? 'text-[#168653]' : 'text-[#77857C] group-hover:text-[#174D35]'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="flex-1 text-left truncate">{item.label}</span>
                  )}
                </button>
              );
            })}

            {/* Install PWA App Button in Sidebar */}
            {!isInstalled && onOpenInstall && (
              <button
                onClick={() => {
                  onOpenInstall();
                  setIsMobileOpen(false);
                }}
                className={`w-full mt-2 flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all group relative cursor-pointer bg-[#F0F9F2] text-[#168653] hover:bg-[#E5F5E9] border border-[#CDE3D2] ${
                  collapsed ? 'justify-center px-0' : ''
                }`}
                title={collapsed ? 'Download / Install App' : undefined}
              >
                <Download className="w-4 h-4 text-[#168653] shrink-0" />
                {!collapsed && (
                  <div className="flex-1 text-left flex items-center justify-between">
                    <span>Install App</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#168653] text-white font-bold">
                      PWA
                    </span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>

        {/* User Card at bottom */}
        <div className="p-3 border-t border-[#E6EDE7] bg-white">
          <div className={`flex items-center gap-3 p-2 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] ${collapsed ? 'justify-center p-1.5' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-[#E5F5E9] text-[#168653] font-bold text-xs flex items-center justify-center shrink-0 border border-[#CDE3D2]">
              A
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#174D35] truncate">Afkar</div>
                <div className="text-[10px] text-[#77857C] truncate">afkar3374@gmail.com</div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
