import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  FolderGit2,
  Receipt,
  FileSpreadsheet,
  Settings,
  ScanLine,
  Users,
  MoreHorizontal,
  X,
  Sparkles,
  Building2,
} from 'lucide-react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { ProjectsView } from './components/ProjectsView';
import { PurchasesView } from './components/PurchasesView';
import { ReportsView } from './components/ReportsView';
import { VendorsView } from './components/VendorsView';
import { SettingsView } from './components/SettingsView';
import { BarcodeScannerView } from './components/BarcodeScannerView';
import { AiAssistantView } from './components/AiAssistantView';
import { GenerateLabelsModal } from './components/GenerateLabelsModal';
import { ItemModal } from './components/ItemModal';
import { PurchaseModal } from './components/PurchaseModal';
import { ProjectModal } from './components/ProjectModal';
import { StockAdjustModal } from './components/StockAdjustModal';
import { ItemDetailsModal } from './components/ItemDetailsModal';
import { AiAddItemModal } from './components/AiAddItemModal';
import { LabelStudioView } from './components/LabelStudioView';
import { PWAInstallModal } from './components/PWAInstallModal';
import { Product, Project } from './types';

function AppContent() {
  const { dbError, products } = useInventory();

  // Navigation tab state
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  // Modal states
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemModalInitialSku, setItemModalInitialSku] = useState<string | undefined>(undefined);
  const [isAiAddItemModalOpen, setIsAiAddItemModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseDefaultProductId, setPurchaseDefaultProductId] = useState<string | undefined>(undefined);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

  const [isStockAdjustModalOpen, setIsStockAdjustModalOpen] = useState(false);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);

  const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false);
  const [labelsModalOptions, setLabelsModalOptions] = useState<
    { startSku?: string; endSku?: string; productId?: string; projectId?: string } | undefined
  >(undefined);
  const [isPwaModalForced, setIsPwaModalForced] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F9F6] text-[#25352C] flex flex-col antialiased selection:bg-[#168653]/15 selection:text-[#174D35]">
      {/* Desktop Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        onOpenScanner={() => setCurrentTab('scanner')}
        onOpenInstall={() => setIsPwaModalForced(true)}
      />

      {/* Main View Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 pb-20 lg:pb-6 ${
          collapsed ? 'lg:pl-18' : 'lg:pl-64'
        }`}
      >
        {/* Global Mint Header */}
        <Header
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          onOpenAi={() => setIsAiDrawerOpen(true)}
          onOpenScanner={() => setCurrentTab('scanner')}
          onOpenInstall={() => setIsPwaModalForced(true)}
          onOpenAddItem={() => {
            setProductToEdit(null);
            setItemModalInitialSku(undefined);
            setIsItemModalOpen(true);
          }}
          onSelectItem={(p) => {
            setDetailsProduct(p);
            setIsDetailsModalOpen(true);
          }}
        />

        {/* Database Warning notification if any */}
        {dbError && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs font-mono text-amber-800">
            {dbError}
          </div>
        )}

        {/* Dynamic Route View Container */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          {/* 1. DASHBOARD WITH ALWAYS-READY SCANNER */}
          {currentTab === 'dashboard' && (
            <DashboardView
              onOpenAddItem={() => {
                setProductToEdit(null);
                setItemModalInitialSku(undefined);
                setIsItemModalOpen(true);
              }}
              onOpenAiAddItem={() => setIsAiAddItemModalOpen(true)}
              onOpenLabels={(opts) => {
                setLabelsModalOptions(opts);
                setIsLabelsModalOpen(true);
              }}
              onViewItemDetails={(p) => {
                setDetailsProduct(p);
                setIsDetailsModalOpen(true);
              }}
              onEditItem={(p) => {
                setProductToEdit(p);
                setIsItemModalOpen(true);
              }}
              onAdjustStock={(p) => {
                setStockAdjustProduct(p);
                setIsStockAdjustModalOpen(true);
              }}
              onOpenAddItemWithSku={(sku) => {
                setProductToEdit(null);
                setItemModalInitialSku(sku);
                setIsItemModalOpen(true);
              }}
              onNavigateToSettings={() => setCurrentTab('settings')}
              onOpenScanner={() => setCurrentTab('scanner')}
              onNavigateToInventory={() => setCurrentTab('inventory')}
              onNavigateToProjects={() => setCurrentTab('projects')}
              onOpenAiAssistant={() => setIsAiDrawerOpen(true)}
            />
          )}

          {/* 2. INVENTORY */}
          {currentTab === 'inventory' && (
            <InventoryView
              onOpenAddItem={() => {
                setProductToEdit(null);
                setItemModalInitialSku(undefined);
                setIsItemModalOpen(true);
              }}
              onOpenAiAddItem={() => setIsAiAddItemModalOpen(true)}
              onEditItem={(p) => {
                setProductToEdit(p);
                setIsItemModalOpen(true);
              }}
              onAdjustStock={(p) => {
                setStockAdjustProduct(p);
                setIsStockAdjustModalOpen(true);
              }}
              onViewItemDetails={(p) => {
                setDetailsProduct(p);
                setIsDetailsModalOpen(true);
              }}
              onOpenLabels={(p) => {
                if (p) {
                  setLabelsModalOptions({ productId: p.id, startSku: p.sku, endSku: p.sku });
                } else {
                  setLabelsModalOptions(undefined);
                }
                setIsLabelsModalOpen(true);
              }}
              onNavigateToStudio={(opts) => {
                setLabelsModalOptions(opts);
                setCurrentTab('studio');
              }}
              onOpenScanner={() => setCurrentTab('scanner')}
            />
          )}

          {/* 3. BARCODE SCANNER */}
          {currentTab === 'scanner' && (
            <BarcodeScannerView
              onOpenItemDetails={(p) => {
                setDetailsProduct(p);
                setIsDetailsModalOpen(true);
              }}
              onOpenAddItemWithSku={(sku) => {
                setProductToEdit(null);
                setItemModalInitialSku(sku);
                setIsItemModalOpen(true);
              }}
              onOpenEditItem={(p) => {
                setProductToEdit(p);
                setIsItemModalOpen(true);
              }}
              onOpenLabelsForProduct={(p) => {
                setLabelsModalOptions({ productId: p.id, startSku: p.sku, endSku: p.sku });
                setIsLabelsModalOpen(true);
              }}
              onNavigateToProjects={() => setCurrentTab('projects')}
              onNavigateToPurchases={() => setCurrentTab('purchases')}
            />
          )}

          {/* 4. PROJECTS */}
          {currentTab === 'projects' && (
            <ProjectsView
              onOpenNewProject={() => {
                setProjectToEdit(null);
                setIsProjectModalOpen(true);
              }}
              onEditProject={(pr) => {
                setProjectToEdit(pr);
                setIsProjectModalOpen(true);
              }}
            />
          )}

          {/* 5. PURCHASES */}
          {currentTab === 'purchases' && (
            <PurchasesView
              onOpenAddPurchase={() => {
                setPurchaseDefaultProductId(undefined);
                setIsPurchaseModalOpen(true);
              }}
            />
          )}

          {/* 6. VENDORS */}
          {currentTab === 'vendors' && <VendorsView />}

          {/* 7. REPORTS */}
          {currentTab === 'reports' && <ReportsView />}

          {/* 8. SETTINGS */}
          {currentTab === 'settings' && <SettingsView />}

          {/* 9. AI ASSISTANT FULL VIEW */}
          {currentTab === 'ai' && (
            <AiAssistantView
              onOpenItemDetails={(p) => {
                setDetailsProduct(p);
                setIsDetailsModalOpen(true);
              }}
              onOpenLabelsModal={(opts) => {
                setLabelsModalOptions(opts);
                setIsLabelsModalOpen(true);
              }}
              onNavigateToStudio={(opts) => {
                setLabelsModalOptions(opts);
                setCurrentTab('studio');
              }}
              onOpenScanner={() => setCurrentTab('scanner')}
            />
          )}

          {/* 10. LABEL STUDIO */}
          {currentTab === 'studio' && (
            <LabelStudioView
              initialProductId={labelsModalOptions?.productId}
              initialStartSku={labelsModalOptions?.startSku}
              initialEndSku={labelsModalOptions?.endSku}
            />
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR                              */}
      {/* ========================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E6EDE7] lg:hidden px-3 py-2 flex items-center justify-around shadow-lg">
        {/* Home */}
        <button
          onClick={() => {
            setCurrentTab('dashboard');
            setIsMobileMoreOpen(false);
          }}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl cursor-pointer transition-colors ${
            currentTab === 'dashboard' ? 'text-[#168653] font-bold' : 'text-[#77857C]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Home</span>
        </button>

        {/* Inventory */}
        <button
          onClick={() => {
            setCurrentTab('inventory');
            setIsMobileMoreOpen(false);
          }}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl cursor-pointer relative transition-colors ${
            currentTab === 'inventory' ? 'text-[#168653] font-bold' : 'text-[#77857C]'
          }`}
        >
          <Boxes className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Inventory</span>
          {products.length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#168653]" />
          )}
        </button>

        {/* Central Prominent Scan Button */}
        <button
          onClick={() => {
            setCurrentTab('scanner');
            setIsMobileMoreOpen(false);
          }}
          className="relative -top-3 w-13 h-13 rounded-full bg-[#168653] hover:bg-[#126b42] text-white flex flex-col items-center justify-center shadow-lg shadow-[#168653]/25 active:scale-95 transition-all cursor-pointer border-4 border-[#F5F9F6]"
          title="Scan Barcode"
        >
          <ScanLine className="w-6 h-6" />
        </button>

        {/* Projects */}
        <button
          onClick={() => {
            setCurrentTab('projects');
            setIsMobileMoreOpen(false);
          }}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl cursor-pointer transition-colors ${
            currentTab === 'projects' ? 'text-[#168653] font-bold' : 'text-[#77857C]'
          }`}
        >
          <FolderGit2 className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Projects</span>
        </button>

        {/* More Menu */}
        <button
          onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl cursor-pointer transition-colors ${
            isMobileMoreOpen ||
            currentTab === 'purchases' ||
            currentTab === 'reports' ||
            currentTab === 'settings' ||
            currentTab === 'vendors'
              ? 'text-[#168653] font-bold'
              : 'text-[#77857C]'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-semibold">More</span>
        </button>
      </nav>

      {/* Mobile More Sheet */}
      {isMobileMoreOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex flex-col justify-end lg:hidden">
          <div
            className="fixed inset-0"
            onClick={() => setIsMobileMoreOpen(false)}
          />
          <div className="relative bg-white rounded-t-3xl border-t border-[#E6EDE7] p-5 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6EDE7]">
              <span className="font-bold text-sm text-[#174D35]">More Lab Features</span>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1 rounded-xl text-[#77857C] hover:bg-[#F5F9F6] hover:text-[#25352C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => {
                  setCurrentTab('purchases');
                  setIsMobileMoreOpen(false);
                }}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F5F9F6] hover:bg-[#E5F5E9] text-left text-xs font-semibold text-[#174D35] border border-[#E6EDE7] transition-colors"
              >
                <Receipt className="w-4 h-4 text-[#168653]" />
                <span>Purchases</span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('reports');
                  setIsMobileMoreOpen(false);
                }}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F5F9F6] hover:bg-[#E5F5E9] text-left text-xs font-semibold text-[#174D35] border border-[#E6EDE7] transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#168653]" />
                <span>Reports</span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('vendors');
                  setIsMobileMoreOpen(false);
                }}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F5F9F6] hover:bg-[#E5F5E9] text-left text-xs font-semibold text-[#174D35] border border-[#E6EDE7] transition-colors"
              >
                <Building2 className="w-4 h-4 text-[#168653]" />
                <span>Suppliers</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsAiDrawerOpen(true);
                }}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#E5F5E9] hover:bg-[#d8eedd] text-left text-xs font-semibold text-[#168653] border border-[#CDE3D2] transition-colors"
              >
                <Sparkles className="w-4 h-4 text-[#168653]" />
                <span>Ask DDLC AI</span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('settings');
                  setIsMobileMoreOpen(false);
                }}
                className="col-span-2 flex items-center justify-center gap-2.5 p-3 rounded-2xl bg-[#F5F9F6] hover:bg-[#E5F5E9] text-center text-xs font-semibold text-[#174D35] border border-[#E6EDE7] transition-colors"
              >
                <Settings className="w-4 h-4 text-[#168653]" />
                <span>System Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SLIDE-OVER AI ASSISTANT DRAWER (WITHOUT LEAVING DASHBOARD)*/}
      {/* ========================================================= */}
      {isAiDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-2xs transition-opacity"
            onClick={() => setIsAiDrawerOpen(false)}
          />
          <div className="relative w-full max-w-lg md:max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            <AiAssistantView
              isDrawer
              onClose={() => setIsAiDrawerOpen(false)}
              onOpenItemDetails={(p) => {
                setDetailsProduct(p);
                setIsDetailsModalOpen(true);
              }}
              onOpenLabelsModal={(opts) => {
                setLabelsModalOptions(opts);
                setIsLabelsModalOpen(true);
              }}
              onNavigateToStudio={(opts) => {
                setLabelsModalOptions(opts);
                setCurrentTab('studio');
                setIsAiDrawerOpen(false);
              }}
              onOpenScanner={() => {
                setCurrentTab('scanner');
                setIsAiDrawerOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Global Modals */}
      <AiAddItemModal
        isOpen={isAiAddItemModalOpen}
        onClose={() => setIsAiAddItemModalOpen(false)}
      />

      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setItemModalInitialSku(undefined);
        }}
        productToEdit={productToEdit}
        initialSku={itemModalInitialSku}
      />

      <GenerateLabelsModal
        isOpen={isLabelsModalOpen}
        onClose={() => setIsLabelsModalOpen(false)}
        initialProductId={labelsModalOptions?.productId}
        initialStartSku={labelsModalOptions?.startSku}
        initialEndSku={labelsModalOptions?.endSku}
        initialProjectId={labelsModalOptions?.projectId}
      />

      <PurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        defaultProductId={purchaseDefaultProductId}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projectToEdit={projectToEdit}
      />

      <StockAdjustModal
        isOpen={isStockAdjustModalOpen}
        onClose={() => setIsStockAdjustModalOpen(false)}
        product={stockAdjustProduct}
      />

      <ItemDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        product={detailsProduct}
        onEdit={(p) => {
          setProductToEdit(p);
          setIsItemModalOpen(true);
        }}
        onAdjustStock={(p) => {
          setStockAdjustProduct(p);
          setIsStockAdjustModalOpen(true);
        }}
        onAddPurchase={(p) => {
          setPurchaseDefaultProductId(p.id);
          setIsPurchaseModalOpen(true);
        }}
        onGenerateLabel={(p) => {
          setLabelsModalOptions({ productId: p.id, startSku: p.sku, endSku: p.sku });
          setIsLabelsModalOpen(true);
        }}
        onNavigateToProject={() => setCurrentTab('projects')}
        onNavigateToPurchases={() => setCurrentTab('purchases')}
      />

      {/* PWA Download / Installation Popup on First Use or Trigger */}
      <PWAInstallModal
        forceOpen={isPwaModalForced}
        onClose={() => setIsPwaModalForced(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <InventoryProvider>
      <AppContent />
    </InventoryProvider>
  );
}
