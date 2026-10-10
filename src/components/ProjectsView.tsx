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
    Beta: { bg: 'bg-[#121E16]', text: 'text-[#00FF66]', border: 'border-[#00FF66]/30' },
    Active: { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-600/40' },
    Planning: { bg: 'bg-cyan-950/40', text: 'text-cyan-400', border: 'border-cyan-600/40' },
    Completed: { bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-600/40' },
    Archived: { bg: 'bg-gray-800/40', text: 'text-gray-400', border: 'border-gray-700' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide font-display flex items-center gap-2">
            <span>Engineering Projects</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-[#161F18] text-[#00FF66] border border-[#00FF66]/30">
              {projects.length} Total
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Hardware revision pipelines, allocated BOM materials, and audited purchase ledgers.
          </p>
        </div>

        <button
          onClick={onOpenNewProject}
          className="px-3.5 py-1.5 rounded-xl bg-[#131E17] hover:bg-[#18281E] border border-[#00FF66]/40 text-[#00FF66] font-mono text-xs font-medium flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,255,102,0.15)] self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Manual Project Form</span>
        </button>
      </div>

      {/* Omnipresent AI Command Engine for Projects */}
      <AiCommandBar
        placeholder="Tell DDLC AI: Create project Beta 3, change status of Beta 1, or assign components..."
        samplePrompts={[
          'Create project Beta 3 - Telemetry System',
          'Create project Gamma 0 - Flight Computer',
          'Assign STM32 BlackPill to Beta 2',
        ]}
        onOpenFullAssistant={onNavigateToAssistant}
      />

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-[#101418] border border-dashed border-[#232D36] rounded-2xl p-8">
            <FolderGit2 className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white">No projects created</h3>
            <p className="text-xs text-gray-400 mt-1">
              Add a new engineering project (e.g. Beta 0, Beta 1, Beta 2, Gamma 0).
            </p>
          </div>
        ) : (
          projects.map((proj) => {
            const stats = getProjectStats(proj.id);
            const style = statusColors[proj.status] || statusColors.Active;

            return (
              <div
                key={proj.id}
                className={`bg-[#101418] border rounded-2xl p-5 transition-all flex flex-col justify-between group cursor-pointer ${
                  selectedProjectId === proj.id
                    ? 'border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.15)] bg-[#12171C]'
                    : 'border-[#1C242C] hover:border-[#2C3844]'
                }`}
                onClick={() => setSelectedProjectId(proj.id)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#161D22] text-[#00FF66] border border-[#232E37]">
                      {proj.code}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${style.bg} ${style.text} ${style.border}`}
                    >
                      {proj.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-[#00FF66] transition-colors">
                    {proj.name}
                  </h3>

                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                    {proj.description || 'No description provided.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#182026] grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-[#141A1F] border border-[#1E262E]">
                      <span className="text-[10px] text-gray-400 block">TOTAL EXPENDITURE</span>
                      <span className="text-amber-400 font-semibold">
                        {formatINR(stats.totalExpenditure)}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-[#141A1F] border border-[#1E262E]">
                      <span className="text-[10px] text-gray-400 block">STOCK VALUE</span>
                      <span className="text-[#00FF66] font-semibold">
                        {formatINR(stats.currentAllocatedStockValue)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#182026] flex items-center justify-between text-xs text-gray-400 font-mono">
                  <div className="flex items-center gap-3">
                    <span>{stats.itemsCount} SKUs</span>
                    <span>•</span>
                    <span>{stats.purchasesCount} POs</span>
                  </div>

                  <div className="flex items-center gap-1 text-gray-400 group-hover:text-white transition-colors">
                    <span>Details</span>
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
        <div className="bg-[#101418] border border-[#1F272F] rounded-2xl p-6 shadow-2xl relative">
          <div className="flex items-start justify-between pb-4 border-b border-[#182026]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-[#161D22] text-[#00FF66] border border-[#00FF66]/30">
                  {selectedProject.code}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#161D22] text-gray-300 border border-gray-700">
                  STATUS: {selectedProject.status}
                </span>
                {selectedProject.startDate && (
                  <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    Started: {selectedProject.startDate}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white font-display">
                {selectedProject.name} — Technical Ledger & Allocation
              </h3>
              <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
                {selectedProject.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditProject(selectedProject)}
                className="px-3 py-1.5 rounded-lg bg-[#141A1F] text-gray-300 hover:text-white border border-[#232D35] text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Project</span>
              </button>

              <button
                onClick={() => setSelectedProjectId(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C242C] transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Financial Separation Alert Banner */}
          <div className="my-5 p-4 rounded-xl bg-[#12181D] border border-[#202931] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div>
                <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">
                  Recorded Purchase Expenditure (Historical Ledger)
                </span>
                <span className="text-2xl font-bold font-mono text-amber-400">
                  {formatINR(projectStats.totalExpenditure)}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Sum of all invoice totals billed to {selectedProject.name}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block">
                  Current Allocated Stock Value (BOM Value)
                </span>
                <span className="text-2xl font-bold font-mono text-[#00FF66]">
                  {formatINR(projectStats.currentAllocatedStockValue)}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Market value of active items currently assigned to this project
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-400 font-mono bg-[#0D1114] p-3 rounded-lg border border-[#1A2228] max-w-xs">
              <div className="text-gray-300 font-semibold mb-1 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#00FF66]" />
                Accounting Integrity
              </div>
              Purchase costs are tracked independently from stock valuation to eliminate double-counting.
            </div>
          </div>

          {/* Assigned Items & Purchases Ledger in Tabs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Assigned Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#1A2228]">
                <h4 className="text-xs font-mono uppercase tracking-wider text-gray-300 font-semibold flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                  Assigned Inventory ({projectProducts.length})
                </h4>
              </div>

              {projectProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 font-mono bg-[#0D1013] rounded-xl border border-[#182026]">
                  No items currently assigned to this project.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {projectProducts.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329] flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#00FF66] font-semibold">
                            {p.sku}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {p.category}
                          </span>
                        </div>
                        <div className="font-medium text-white truncate mt-0.5">
                          {p.name}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <div className="text-white font-semibold">
                          {p.quantity} {p.unit}
                        </div>
                        <div className="text-[10px] text-gray-400">
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
              <div className="flex items-center justify-between pb-2 border-b border-[#1A2228]">
                <h4 className="text-xs font-mono uppercase tracking-wider text-gray-300 font-semibold flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-amber-400" />
                  Purchases Incurred ({projectPurchases.length})
                </h4>
              </div>

              {projectPurchases.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 font-mono bg-[#0D1013] rounded-xl border border-[#182026]">
                  No purchase records logged directly for this project.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {projectPurchases.map((po) => (
                    <div
                      key={po.id}
                      className="p-3 rounded-xl bg-[#13171B] border border-[#1C2329] flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white font-semibold">
                            {po.purchaseNumber}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {po.purchaseDate}
                          </span>
                        </div>
                        <div className="text-gray-300 truncate mt-0.5">
                          {po.quantity}x {po.productNameSnapshot}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Vendor: {po.vendorNameSnapshot} • Inv #{po.invoiceNumber}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <div className="text-amber-400 font-bold">
                          {formatINR(po.invoiceTotal)}
                        </div>
                        <div className="text-[9px] text-gray-400 uppercase">
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
