import React, { useState } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { BarcodeScannerView } from './components/BarcodeScannerView';
import { GenerateLabelsModal } from './components/GenerateLabelsModal';
import { ProjectsView } from './components/ProjectsView';
import { PurchasesView } from './components/PurchasesView';
import { AiAssistantView } from './components/AiAssistantView';
import { ReportsView } from './components/ReportsView';
import { VendorsView } from './components/VendorsView';
import { ItemModal } from './components/ItemModal';
import { PurchaseModal } from './components/PurchaseModal';
import { ProjectModal } from './components/ProjectModal';
import { StockAdjustModal } from './components/StockAdjustModal';
import { ItemDetailsModal } from './components/ItemDetailsModal';
import { AiAddItemModal } from './components/AiAddItemModal';
import { Product, Project } from './types';

function AppContent() {
  const { dbError } = useInventory();

  // Navigation
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [initialAiPrompt, setInitialAiPrompt] = useState<string>('');
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#090B0C] text-[#EDEDED] flex">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'labels') {
            setLabelsModalOptions(undefined);
            setIsLabelsModalOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          collapsed ? 'lg:pl-18' : 'lg:pl-64'
        }`}
      >
        {/* Header Telemetry Bar */}
        <Header
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          onOpenAi={() => setCurrentTab('assistant')}
        />

        {/* Database notification warning if any */}
        {dbError && (
          <div className="bg-amber-950/40 border-b border-amber-600/30 px-6 py-2 text-xs font-mono text-amber-300">
            {dbError}
          </div>
        )}

        {/* Active View Container */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={(tab, prompt) => {
                if (prompt) setInitialAiPrompt(prompt);
                setCurrentTab(tab);
              }}
              onOpenAddItem={() => {
                setProductToEdit(null);
                setItemModalInitialSku(undefined);
                setIsItemModalOpen(true);
              }}
              onOpenScanner={() => setCurrentTab('scanner')}
              onOpenLabels={() => {
                setLabelsModalOptions(undefined);
                setIsLabelsModalOpen(true);
              }}
              onViewItemDetails={(p) => {
                setDetailsProduct(p);
                setIsDetailsModalOpen(true);
              }}
            />
          )}

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
                setItemModalInitialSku(undefined);
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
              onNavigateToAssistant={(prompt) => {
                setInitialAiPrompt(prompt);
                setCurrentTab('assistant');
              }}
              onOpenScanner={() => setCurrentTab('scanner')}
              onOpenLabels={(p) => {
                setLabelsModalOptions(
                  p ? { productId: p.id, startSku: p.sku, endSku: p.sku } : undefined
                );
                setIsLabelsModalOpen(true);
              }}
            />
          )}

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
                setItemModalInitialSku(undefined);
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

          {currentTab === 'projects' && (
            <ProjectsView
              onOpenNewProject={() => {
                setProjectToEdit(null);
                setIsProjectModalOpen(true);
              }}
              onEditProject={(proj) => {
                setProjectToEdit(proj);
                setIsProjectModalOpen(true);
              }}
              onNavigateToAssistant={(prompt) => {
                setInitialAiPrompt(prompt);
                setCurrentTab('assistant');
              }}
            />
          )}

          {currentTab === 'purchases' && (
            <PurchasesView
              onOpenAddPurchase={() => {
                setPurchaseDefaultProductId(undefined);
                setIsPurchaseModalOpen(true);
              }}
              onNavigateToAssistant={(prompt) => {
                setInitialAiPrompt(prompt);
                setCurrentTab('assistant');
              }}
            />
          )}

          {currentTab === 'assistant' && (
            <AiAssistantView
              initialPrompt={initialAiPrompt}
              onClearInitialPrompt={() => setInitialAiPrompt('')}
              onOpenItemDetails={(p) => {
                setDetailsProduct(p);
                setIsDetailsModalOpen(true);
              }}
              onOpenLabelsModal={(opts) => {
                setLabelsModalOptions(opts);
                setIsLabelsModalOpen(true);
              }}
            />
          )}

          {currentTab === 'reports' && <ReportsView />}

          {currentTab === 'vendors' && (
            <VendorsView
              onNavigateToAssistant={(prompt) => {
                setInitialAiPrompt(prompt);
                setCurrentTab('assistant');
              }}
            />
          )}
        </main>
      </div>

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
