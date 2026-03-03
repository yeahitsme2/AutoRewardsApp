import { CheckCircle, XCircle, Download, Trash2, Mail } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onConfirmSelected: () => void;
  onCancelSelected: () => void;
  onDeleteSelected: () => void;
  onExportSelected: () => void;
  onSendRemindersSelected: () => void;
  onClearSelection: () => void;
  brandColor: string;
}

export function BulkActionsBar({
  selectedCount,
  onConfirmSelected,
  onCancelSelected,
  onDeleteSelected,
  onExportSelected,
  onSendRemindersSelected,
  onClearSelection,
  brandColor,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border-2 px-6 py-4 z-50"
      style={{ borderColor: brandColor }}
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: brandColor }}
          >
            {selectedCount}
          </div>
          <span className="font-semibold text-slate-900">
            {selectedCount} appointment{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="h-6 w-px bg-slate-300" />

        <div className="flex items-center gap-2">
          <button
            onClick={onConfirmSelected}
            className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            <CheckCircle className="w-4 h-4" />
            Confirm
          </button>

          <button
            onClick={onSendRemindersSelected}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
          >
            <Mail className="w-4 h-4" />
            Send Reminders
          </button>

          <button
            onClick={onExportSelected}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <button
            onClick={onCancelSelected}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Cancel
          </button>

          <button
            onClick={onClearSelection}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
