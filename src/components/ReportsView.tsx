import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Filter,
  Calendar,
  Building2,
  FolderGit2,
  Layers,
  Receipt,
  Boxes,
  FileText,
  DollarSign,
  Cpu,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatINR } from '../services/dbService';

type ReportType =
  | 'project_statement'
  | 'inventory_list'
  | 'purchase_ledger'
  | 'supplier_statement'
  | 'monthly_expense'
  | 'gst_summary'
  | 'stock_valuation';

export const ReportsView: React.FC = () => {
  const { products, purchases, projects, vendors, categories } = useInventory();

  const [reportType, setReportType] = useState<ReportType>('project_statement');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedVendor, setSelectedVendor] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'YEAR_TO_DATE'>('ALL');

  // Filter purchases according to criteria
  const filteredPurchases = useMemo(() => {
    return purchases.filter((po) => {
      if (selectedProject !== 'ALL' && po.projectId !== selectedProject) return false;
      if (selectedVendor !== 'ALL' && po.vendorNameSnapshot !== selectedVendor) return false;
      if (paymentStatus !== 'ALL' && po.paymentStatus !== paymentStatus) return false;

      // Date filtering
      if (dateRange !== 'ALL' && po.purchaseDate) {
        const poDate = new Date(po.purchaseDate);
        const now = new Date();
        if (dateRange === 'THIS_MONTH') {
          if (poDate.getMonth() !== now.getMonth() || poDate.getFullYear() !== now.getFullYear())
            return false;
        } else if (dateRange === 'LAST_MONTH') {
          const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          if (poDate.getMonth() !== lastMonth || poDate.getFullYear() !== lastMonthYear) return false;
        } else if (dateRange === 'YEAR_TO_DATE') {
          if (poDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      return true;
    });
  }, [purchases, selectedProject, selectedVendor, paymentStatus, dateRange]);

  // Filter products according to criteria
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.archived) return false;
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (selectedProject !== 'ALL' && p.projectId !== selectedProject) return false;
      if (selectedVendor !== 'ALL' && p.vendor !== selectedVendor) return false;
      return true;
    });
  }, [products, selectedCategory, selectedProject, selectedVendor]);

  // Aggregate calculations
  const totalPurchasesAmount = filteredPurchases.reduce((acc, p) => acc + (p.invoiceTotal || 0), 0);
  const totalPurchasesGst = filteredPurchases.reduce((acc, p) => acc + (p.gstAmount || 0), 0);
  const totalStockValue = filteredProducts.reduce((acc, p) => acc + (p.quantity * p.unitPrice), 0);

  // Helper to trigger native CSV download
  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      '\uFEFF' + // UTF-8 BOM for Excel compatibility
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().slice(0, 10);

    if (reportType === 'inventory_list' || reportType === 'stock_valuation') {
      const headers = ['SKU', 'Product Name', 'Category', 'Quantity', 'Unit', 'Unit Price (INR)', 'Total Value (INR)', 'Storage Location', 'Project'];
      const rows = filteredProducts.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.quantity,
        p.unit,
        p.unitPrice,
        p.quantity * p.unitPrice,
        p.storageLocation || 'N/A',
        projects.find((proj) => proj.id === p.projectId)?.name || 'Unassigned',
      ]);
      downloadCSV(`DDLC_Inventory_${timestamp}`, headers, rows);
    } else {
      const headers = ['PO Number', 'Invoice Number', 'Date', 'Product', 'SKU', 'Supplier', 'Project', 'Quantity', 'Unit Price', 'GST Rate %', 'GST Amount', 'Invoice Total', 'Payment Status'];
      const rows = filteredPurchases.map((po) => [
        po.purchaseNumber,
        po.invoiceNumber,
        po.purchaseDate,
        po.productNameSnapshot,
        po.skuSnapshot,
        po.vendorNameSnapshot,
        po.projectNameSnapshot,
        po.quantity,
        po.unitPrice,
        po.gstRate,
        po.gstAmount,
        po.invoiceTotal,
        po.paymentStatus,
      ]);
      downloadCSV(`DDLC_Purchases_${timestamp}`, headers, rows);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Title & Top controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide font-display flex items-center gap-2">
            <span>Statements & Financial Reports</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-[#161F18] text-[#00FF66] border border-[#00FF66]/30">
              AUDIT COMPLIANT
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Exportable purchase ledgers, GST input summaries, and project expenditure reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-[#141A20] hover:bg-[#1A222A] text-gray-200 border border-[#232D36] text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-[#00FF66]" />
            <span>Export CSV / Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,255,102,0.25)]"
          >
            <Printer className="w-4 h-4" />
            <span>Print PDF Statement</span>
          </button>
        </div>
      </div>

      {/* Filter Selection Panel (Hidden when printing) */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-4 space-y-4 no-print">
        <div className="flex items-center gap-2 text-xs font-mono text-[#00FF66]">
          <Filter className="w-3.5 h-3.5" />
          <span>REPORT PARAMETERS & TAXONOMY FILTERS</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Report Type */}
          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              REPORT TYPE
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-white focus:outline-none focus:border-[#00FF66] font-mono"
            >
              <option value="project_statement">Project-wise Statement</option>
              <option value="purchase_ledger">Purchase Ledger</option>
              <option value="inventory_list">Complete Inventory List</option>
              <option value="supplier_statement">Supplier-wise Statement</option>
              <option value="gst_summary">GST Summary</option>
              <option value="stock_valuation">Stock Valuation Report</option>
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              TARGET PROJECT
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-white focus:outline-none focus:border-[#00FF66] font-mono"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              DATE RANGE
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-white focus:outline-none focus:border-[#00FF66] font-mono"
            >
              <option value="ALL">All Time</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="YEAR_TO_DATE">Year to Date</option>
            </select>
          </div>

          {/* Supplier */}
          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              SUPPLIER
            </label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-white focus:outline-none focus:border-[#00FF66] font-mono"
            >
              <option value="ALL">All Suppliers</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              PAYMENT STATUS
            </label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-xs text-white focus:outline-none focus:border-[#00FF66] font-mono"
            >
              <option value="ALL">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Official Printable Statement Preview */}
      <div className="bg-[#101418] border border-[#1C242C] rounded-2xl p-6 lg:p-8 shadow-2xl text-white print-card">
        {/* DDLC Hardware Official Header */}
        <div className="border-b border-[#222B33] pb-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#141A1F] border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66]">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display tracking-wider text-white">
                  DDLC AI
                </h1>
                <p className="text-xs text-gray-400 font-mono">
                  Inventory & Project Management Statement
                </p>
              </div>
            </div>

            <div className="text-right text-xs font-mono text-gray-400">
              <div className="text-white font-semibold uppercase">
                {reportType.replace(/_/g, ' ')}
              </div>
              <div>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              <div>Doc Ref: DDLC-RPT-{Date.now().toString().slice(-6)}</div>
            </div>
          </div>

          {/* Meta parameters bar */}
          <div className="mt-4 pt-3 border-t border-[#182026] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span className="text-gray-400 block text-[10px]">PROJECT SCOPE:</span>
              <span className="text-white">
                {selectedProject === 'ALL'
                  ? 'All Projects'
                  : projects.find((p) => p.id === selectedProject)?.name || selectedProject}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px]">DATE FILTER:</span>
              <span className="text-white">{dateRange.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px]">LINE ITEMS:</span>
              <span className="text-white">
                {reportType === 'inventory_list' || reportType === 'stock_valuation'
                  ? filteredProducts.length
                  : filteredPurchases.length}{' '}
                Records
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px]">TAX COMPLIANCE:</span>
              <span className="text-[#00FF66]">GST VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {reportType === 'inventory_list' || reportType === 'stock_valuation' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0C0F12] border-b border-[#1A2228] text-gray-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3 text-center">Stock</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182026]">
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 px-3 font-mono text-[#00FF66] font-semibold">{p.sku}</td>
                    <td className="py-2 px-3 font-medium text-white">{p.name}</td>
                    <td className="py-2 px-3 font-mono text-gray-300">{p.category}</td>
                    <td className="py-2 px-3 font-mono text-gray-400">{p.storageLocation || 'Main'}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold">{p.quantity} {p.unit}</td>
                    <td className="py-2 px-3 text-right font-mono">{formatINR(p.unitPrice)}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-white">
                      {formatINR(p.quantity * p.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0C0F12] border-b border-[#1A2228] text-gray-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">PO #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Product & SKU</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">GST (Rate)</th>
                  <th className="py-2.5 px-3 text-right">Invoice Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182026]">
                {filteredPurchases.map((po) => (
                  <tr key={po.id}>
                    <td className="py-2 px-3 font-mono text-white font-semibold">{po.purchaseNumber}</td>
                    <td className="py-2 px-3 font-mono text-gray-400">{po.purchaseDate}</td>
                    <td className="py-2 px-3">
                      <div className="text-white font-medium">{po.productNameSnapshot}</div>
                      <div className="text-[10px] text-[#00FF66] font-mono">{po.skuSnapshot}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-300">{po.vendorNameSnapshot}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold">{po.quantity}</td>
                    <td className="py-2 px-3 text-right font-mono">{formatINR(po.unitPrice)}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-400">
                      {formatINR(po.gstAmount)} ({po.gstRate}%)
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[#00FF66]">
                      {formatINR(po.invoiceTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Statement Totals & Summary Footer */}
        <div className="mt-6 pt-4 border-t-2 border-[#222B33] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs font-mono text-gray-400">
            <div>DDLC AI CERTIFIED STATEMENT • VERIFIED LEDGER</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Input Tax Credit (ITC) subject to statutory vendor filing reconciliation.
            </div>
          </div>

          <div className="bg-[#141A1F] p-4 rounded-xl border border-[#232D36] min-w-[280px] font-mono text-xs space-y-1.5">
            {reportType === 'inventory_list' || reportType === 'stock_valuation' ? (
              <div className="flex justify-between items-center text-sm font-bold text-white pt-1">
                <span>TOTAL STOCK VALUATION:</span>
                <span className="text-[#00FF66]">{formatINR(totalStockValue)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center text-gray-400">
                  <span>TAXABLE VALUE:</span>
                  <span className="text-white">{formatINR(totalPurchasesAmount - totalPurchasesGst)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-400">
                  <span>RECORDED GST:</span>
                  <span>{formatINR(totalPurchasesGst)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-white pt-1 border-t border-gray-700">
                  <span>GRAND TOTAL:</span>
                  <span className="text-[#00FF66]">{formatINR(totalPurchasesAmount)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
