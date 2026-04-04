import { useState } from 'react';
import { CheckCircle, XCircle, Download, Mail, X, AlertTriangle } from 'lucide-react';

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
  const [confirmPending, setConfirmPending] = useState<null | 'confirm' | 'cancel' | 'reminders'>(null);

  if (selectedCount === 0) return null;

  const handleAction = (action: 'confirm' | 'cancel' | 'reminders') => {
    setConfirmPending(action);
  };

  const handleProceed = () => {
    if (confirmPending === 'confirm') onConfirmSelected();
    else if (confirmPending === 'cancel') onCancelSelected();
    else if (confirmPending === 'reminders') onSendRemindersSelected();
    setConfirmPending(null);
  };

  const actionLabels: Record<string, string> = {
    confirm: `Confirm ${selectedCount} appointment${selectedCount !== 1 ? 's' : ''}?`,
    cancel: `Cancel ${selectedCount} appointment${selectedCount !== 1 ? 's' : ''}? This cannot be undone.`,
    reminders: `Send reminder${selectedCount !== 1 ? 's' : ''} to ${selectedCount} customer${selectedCount !== 1 ? 's' : ''}?`,
  };

  return (
    <>
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border px-5 py-3.5 z-40 flex items-center gap-4"
        style={{ borderColor: `${brandColor}40` }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: brandColor }}
          >
            {selectedCount}
          </div>
          <span className="font-medium text-slate-900 text-sm whitespace-nowrap">
            {selectedCount} selected
          </span>
        </div>

        <div className="h-5 w-px bg-slate-200 shrink-0" />

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleAction('confirm')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-medium rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Confirm
          </button>

          <button
            onClick={() => handleAction('reminders')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Remind
          </button>

          <button
            onClick={onExportSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button
            onClick={() => handleAction('cancel')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel
          </button>

          <button
            onClick={onClearSelection}
            className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {confirmPending && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Are you sure?</h3>
                <p className="text-sm text-slate-600 mt-1">{actionLabels[confirmPending]}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmPending(null)}
                className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
              >
                Go Back
              </button>
              <button
                onClick={handleProceed}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-xl text-white ${
                  confirmPending === 'cancel' ? 'bg-red-500 hover:bg-red-600' : 'hover:opacity-90'
                }`}
                style={confirmPending !== 'cancel' ? { backgroundColor: brandColor } : undefined}
              >
                Yes, proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
