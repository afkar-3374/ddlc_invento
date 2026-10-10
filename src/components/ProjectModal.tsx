import React, { useState, useEffect } from 'react';
import { X, FolderGit2, AlertCircle } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#101418] border border-[#222B33] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-[#182026] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#141A1F] border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                {projectToEdit ? 'Edit Engineering Project' : 'Create New Project'}
              </h3>
              <p className="text-[11px] font-mono text-gray-400">
                Track dedicated BOM expenditure & active stock value
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                PROJECT NAME *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Beta 2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                CODE *
              </label>
              <input
                type="text"
                required
                placeholder="BETA-2"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-[#00FF66] font-mono font-bold focus:outline-none focus:border-[#00FF66]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                STATUS
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              >
                <option value="Beta">Beta (Prototype Trial)</option>
                <option value="Active">Active (In Production)</option>
                <option value="Planning">Planning</option>
                <option value="Completed">Completed</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-gray-400 block mb-1">
                START DATE
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white font-mono focus:outline-none focus:border-[#00FF66]"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              DESCRIPTION
            </label>
            <textarea
              rows={2}
              placeholder="Hardware scope, architecture, intended capabilities..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-gray-400 block mb-1">
              NOTES / MILESTONES
            </label>
            <input
              type="text"
              placeholder="e.g. Thermal sign-off completed, ready for pilot run"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#141A1F] border border-[#232D35] text-white focus:outline-none focus:border-[#00FF66]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#182026]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#141A1F] text-gray-400 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#00FF66] hover:bg-[#1aff75] text-[#0A0D0F] font-semibold flex items-center gap-2 shadow-[0_0_12px_rgba(0,255,102,0.25)] disabled:opacity-50"
            >
              {saving ? 'Saving...' : projectToEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
