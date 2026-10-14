import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  Edit2,
  Calendar,
  Boxes,
  Receipt,
  TrendingUp,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  X,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Project, Product, Purchase } from '../types';
import { formatINR } from '../services/dbService';
import { AiCommandBar } from './AiCommandBar';

interface ProjectsViewProps {
  onOpenNewProject: () => void;
  onEditProject: (project: Project) => void;
  onNavigateToAssistant?: (prompt: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onOpenNewProject,
  onEditProject,
  onNavigateToAssistant,
}) => {
  const { projects, products, purchases, getProjectStats } = useInventory();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  // Selected project data
  const projectProducts = selectedProject
    ? products.filter((p) => p.projectId === selectedProject.id && !p.archived)
    : [];

  const projectPurchases = selectedProject
    ? purchases.filter((p) => p.projectId === selectedProject.id)
    : [];

  const projectStats = selectedProject ? getProjectStats(selectedProject.id) : null;

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    Beta: { bg: 'bg-[#E5F5E9]', text: 'text-[#168653]', border: 'border-[#C6E7D2]' },
    Active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    Planning: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    Completed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    Archived: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#E6EDE7] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2] flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5" />
              Hardware Projects
            </span>
            <span className="text-xs text-[#77857C]">{projects.length} Total Registered</span>
          </div>
          <h2 className="text-lg font-bold text-[#174D35] tracking-tight">
            Engineering Projects & BOM Tracking
          </h2>
          <p className="text-xs text-[#77857C] mt-0.5">
            Hardware revision pipelines, allocated BOM materials, and audited purchase ledgers.
          </p>
        </div>

        <button
          onClick={onOpenNewProject}
          className="px-4 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Omnipresent AI Command Engine for Projects */}
      <AiCommandBar
        placeholder="Tell DDLC AI: Create project Rover MK-2, change status of Beta 1, or assign components..."
        samplePrompts={[
          'Create project Rover MK-2 - Autonomous Rover',
          'Create project Drone VTOL - Flight Computer',
          'Assign STM32 BlackPill to Rover MK-2',
        ]}
        onOpenFullAssistant={onNavigateToAssistant}
      />

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white border border-dashed border-[#E6EDE7] rounded-3xl p-8">
            <div className="w-12 h-12 rounded-2xl bg-[#E5F5E9] text-[#168653] flex items-center justify-center mx-auto mb-3">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#174D35]">No projects created yet</h3>
            <p className="text-xs text-[#77857C] mt-1 max-w-sm mx-auto">
              Add a new engineering project or ask the DDLC AI assistant to create one for you.
            </p>
          </div>
        ) : (
          projects.map((proj) => {
            const stats = getProjectStats(proj.id);
            const style = statusColors[proj.status] || statusColors.Active;

            return (
              <div
                key={proj.id}
                className={`bg-white border rounded-3xl p-5 transition-all flex flex-col justify-between group cursor-pointer shadow-xs hover:shadow-md ${
                  selectedProjectId === proj.id
                    ? 'border-[#168653] ring-2 ring-[#168653]/10 bg-[#F0F9F2]'
                    : 'border-[#E6EDE7] hover:border-[#C6E7D2]'
                }`}
                onClick={() => setSelectedProjectId(proj.id)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2]">
                      {proj.code}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase ${style.bg} ${style.text} ${style.border}`}
                    >
                      {proj.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#174D35] group-hover:text-[#168653] transition-colors">
                    {proj.name}
                  </h3>

                  <p className="text-xs text-[#77857C] mt-1 line-clamp-2 leading-relaxed">
                    {proj.description || 'Hardware prototype tracking and bill of materials.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#F0F5F2] grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7]">
                      <span className="text-[10px] font-semibold text-[#77857C] uppercase block">TOTAL EXPENDITURE</span>
                      <span className="text-[#0284C7] font-bold">
                        {formatINR(stats.totalExpenditure)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7]">
                      <span className="text-[10px] font-semibold text-[#77857C] uppercase block">STOCK VALUE</span>
                      <span className="text-[#168653] font-bold">
                        {formatINR(stats.currentAllocatedStockValue)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0F5F2] flex items-center justify-between text-xs text-[#77857C]">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{stats.itemsCount} SKUs</span>
                    <span>•</span>
                    <span className="font-medium">{stats.purchasesCount} POs</span>
                  </div>

                  <div className="flex items-center gap-1 font-semibold text-[#168653] group-hover:translate-x-0.5 transition-transform">
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Project Details Modal / Drawer */}
      {selectedProject && projectStats && (
        <div className="bg-white border border-[#E6EDE7] rounded-3xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between pb-4 border-b border-[#F0F5F2]">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-[#E5F5E9] text-[#168653] border border-[#C6E7D2]">
                  {selectedProject.code}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F5F9F6] text-[#25352C] border border-[#E6EDE7]">
                  STATUS: {selectedProject.status}
                </span>
                {selectedProject.startDate && (
                  <span className="text-xs text-[#77857C] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#77857C]" />
                    Started: {selectedProject.startDate}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-[#174D35] tracking-tight">
                {selectedProject.name} — Technical Ledger & Allocation
              </h3>
              <p className="text-xs text-[#77857C] mt-1 max-w-2xl leading-relaxed">
                {selectedProject.description || 'Hardware prototype tracking and bill of materials.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditProject(selectedProject)}
                className="px-3 py-1.5 rounded-xl bg-[#F5F9F6] text-[#25352C] hover:text-[#174D35] hover:bg-[#E5F5E9] border border-[#E6EDE7] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#168653]" />
                <span>Edit Project</span>
              </button>

              <button
                onClick={() => setSelectedProjectId(null)}
                className="p-1.5 rounded-xl text-[#77857C] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Financial Separation Alert Banner */}
          <div className="my-5 p-4 rounded-2xl bg-[#F0F9F2] border border-[#C6E7D2] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div>
                <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider block">
                  Recorded Purchase Expenditure (Historical Ledger)
                </span>
                <span className="text-2xl font-bold text-[#0284C7]">
                  {formatINR(projectStats.totalExpenditure)}
                </span>
                <span className="text-[11px] text-[#77857C] block mt-0.5">
                  Sum of all invoice totals billed to {selectedProject.name}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-[#77857C] uppercase tracking-wider block">
                  Current Allocated Stock Value (BOM Value)
                </span>
                <span className="text-2xl font-bold text-[#168653]">
                  {formatINR(projectStats.currentAllocatedStockValue)}
                </span>
                <span className="text-[11px] text-[#77857C] block mt-0.5">
                  Current value of active items assigned to this project
                </span>
              </div>
            </div>

            <div className="text-xs text-[#25352C] bg-white p-3.5 rounded-xl border border-[#E6EDE7] max-w-xs shadow-2xs">
              <div className="text-[#174D35] font-bold mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#168653]" />
                Accounting Integrity
              </div>
              <p className="text-[11px] text-[#77857C]">
                Purchase costs are tracked independently from stock valuation to eliminate double-counting.
              </p>
            </div>
          </div>

          {/* Assigned Items & Purchases Ledger in Tabs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Assigned Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F0F5F2]">
                <h4 className="text-xs uppercase tracking-wider text-[#174D35] font-bold flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-[#168653]" />
                  Assigned Inventory ({projectProducts.length})
                </h4>
              </div>

              {projectProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#77857C] bg-[#F5F9F6] rounded-2xl border border-[#E6EDE7]">
                  No items currently assigned to this project.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {projectProducts.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#168653] font-bold">
                            {p.sku}
                          </span>
                          <span className="text-[11px] text-[#77857C]">
                            {p.category}
                          </span>
                        </div>
                        <div className="font-bold text-[#174D35] truncate mt-0.5">
                          {p.name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[#25352C] font-bold">
                          {p.quantity} {p.unit}
                        </div>
                        <div className="text-[11px] text-[#77857C]">
                          @{formatINR(p.unitPrice)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Project Purchases History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F0F5F2]">
                <h4 className="text-xs uppercase tracking-wider text-[#174D35] font-bold flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-[#0284C7]" />
                  Purchases Incurred ({projectPurchases.length})
                </h4>
              </div>

              {projectPurchases.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#77857C] bg-[#F5F9F6] rounded-2xl border border-[#E6EDE7]">
                  No purchase records logged directly for this project.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {projectPurchases.map((po) => (
                    <div
                      key={po.id}
                      className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#174D35]">
                            {po.purchaseNumber}
                          </span>
                          <span className="text-[11px] text-[#77857C]">
                            {po.purchaseDate}
                          </span>
                        </div>
                        <div className="text-[#25352C] font-medium truncate mt-0.5">
                          {po.quantity}x {po.productNameSnapshot}
                        </div>
                        <div className="text-[11px] text-[#77857C] mt-0.5">
                          Vendor: {po.vendorNameSnapshot} • Inv #{po.invoiceNumber}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[#0284C7] font-bold">
                          {formatINR(po.invoiceTotal)}
                        </div>
                        <div className="text-[10px] text-[#77857C] uppercase font-semibold">
                          {po.paymentStatus}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
