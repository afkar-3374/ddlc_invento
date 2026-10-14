import React, { useState, useEffect } from 'react';
import { X, FolderGit2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Project } from '../types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  projectToEdit,
}) => {
  const { addProject, editProject } = useInventory();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Project['status']>('Active');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setCode(projectToEdit.code);
      setDescription(projectToEdit.description || '');
      setStatus(projectToEdit.status || 'Active');
      setStartDate(projectToEdit.startDate || new Date().toISOString().slice(0, 10));
      setNotes(projectToEdit.notes || '');
    } else {
      setName('');
      setCode('BETA-');
      setDescription('');
      setStatus('Active');
      setStartDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
    setError(null);
  }, [projectToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Project name and code are required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        status,
        startDate,
        notes: notes.trim(),
      };

      if (projectToEdit) {
        await editProject(projectToEdit.id, payload);
      } else {
        await addProject(payload);
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-[#E6EDE7] rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-[#F0F5F2] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#174D35]">
                {projectToEdit ? 'Edit Engineering Project' : 'Create New Project'}
              </h3>
              <p className="text-xs text-[#77857C]">
                Track dedicated BOM expenditure & stock value
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#77857C] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                PROJECT NAME *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rover MK-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                CODE *
              </label>
              <input
                type="text"
                required
                placeholder="ROVER"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#168653] font-mono font-bold focus:outline-none focus:border-[#168653] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                STATUS
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
              >
                <option value="Beta">Beta (Prototype Trial)</option>
                <option value="Active">Active (In Production)</option>
                <option value="Planning">Planning</option>
                <option value="Completed">Completed</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
                START DATE
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
              DESCRIPTION
            </label>
            <textarea
              rows={2}
              placeholder="Hardware scope, architecture, intended capabilities..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#77857C] block mb-1">
              NOTES / MILESTONES
            </label>
            <input
              type="text"
              placeholder="e.g. Prototype assembly completed, ready for bench test"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F5F9F6] border border-[#E6EDE7] text-[#25352C] focus:outline-none focus:border-[#168653] focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F0F5F2]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#F5F9F6] text-[#77857C] hover:text-[#25352C] font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Saving...' : projectToEdit ? 'Save Changes' : 'Create Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
