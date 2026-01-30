import { X, BadgeCheck, AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';
import { MediaCaptureWidget } from './MediaCaptureWidget';
import type { DviReportItem } from '../../types/database';

export type MediaAttachment = {
  id: string;
  url: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  media_type: string | null;
  duration_seconds: number | null;
  file_size: number | null;
};

type ItemDetailDrawerProps = {
  open: boolean;
  item: DviReportItem | null;
  itemTitle: string;
  sectionTitle: string | null;
  media: MediaAttachment[];
  reportMedia: MediaAttachment[];
  redCount: number;
  yellowCount: number;
  greenCount: number;
  onClose: () => void;
  onUpdateItem: (updates: Partial<DviReportItem>) => void;
  onUploadItemMedia: (file: File, mediaType: 'photo' | 'video' | 'audio') => void;
  onDeleteItemMedia: (media: MediaAttachment) => void;
  onUploadReportMedia: (file: File, mediaType: 'photo' | 'video' | 'audio') => void;
  onDeleteReportMedia: (media: MediaAttachment) => void;
};

const conditionStyles: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-emerald-500 text-white',
  yellow: 'bg-amber-400 text-slate-900',
  red: 'bg-rose-500 text-white',
};

const recommendationOptions = [
  { key: 'ok', label: 'OK', icon: BadgeCheck },
  { key: 'monitor', label: 'Monitor', icon: AlertTriangle },
  { key: 'recommend', label: 'Recommend', icon: AlertCircle },
];

export function ItemDetailDrawer({
  open,
  item,
  itemTitle,
  sectionTitle,
  media,
  reportMedia,
  redCount,
  yellowCount,
  greenCount,
  onClose,
  onUpdateItem,
  onUploadItemMedia,
  onDeleteItemMedia,
  onUploadReportMedia,
  onDeleteReportMedia,
}: ItemDetailDrawerProps) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 w-full bg-white border-t border-slate-200 shadow-2xl transition-transform duration-300 lg:inset-y-0 lg:right-0 lg:left-auto lg:border-l lg:border-t-0 lg:w-[360px] ${
        open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {item ? 'Item detail' : 'Inspection summary'}
          </p>
          <h3 className="text-lg font-semibold text-slate-900">
            {item ? itemTitle : 'Summary & Media'}
          </h3>
          {sectionTitle && item && <p className="text-xs text-slate-500">{sectionTitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-slate-500 hover:text-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-5 overflow-y-auto h-[70vh] lg:h-full">
        {!item && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 mb-2">Inspection status</div>
              <div className="flex gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">{greenCount} green</span>
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700">{yellowCount} yellow</span>
                <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700">{redCount} red</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">Overall inspection media</div>
              <MediaCaptureWidget onFileSelected={onUploadReportMedia} />
              <div className="space-y-2">
                {reportMedia.length === 0 && (
                  <p className="text-xs text-slate-500">No overall media attached yet.</p>
                )}
                {reportMedia.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      {file.mime_type?.startsWith('image/') && (
                        <img src={file.url} alt={file.file_name} className="w-10 h-10 rounded-lg object-cover" />
                      )}
                      {file.mime_type?.startsWith('video/') && (
                        <video src={file.url} controls className="w-12 h-10 rounded-lg object-cover" />
                      )}
                      {file.mime_type?.startsWith('audio/') && (
                        <audio src={file.url} controls className="h-8 w-28" />
                      )}
                      <span className="font-medium text-slate-700">{file.file_name}</span>
                      {file.media_type && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{file.media_type}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteReportMedia(file)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {item && (
          <>
            <div className="space-y-3">
              <div className="text-xs text-slate-500">Status</div>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                {(['green', 'yellow', 'red'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onUpdateItem({ condition: status })}
                    className={`rounded-lg px-3 py-2 ${item.condition === status ? conditionStyles[status] : 'border border-slate-200 text-slate-600'}`}
                  >
                    {status.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-500">Recommendation</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {recommendationOptions.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onUpdateItem({ recommendation_status: key })}
                    className={`rounded-lg px-2 py-2 border text-slate-600 flex flex-col items-center gap-1 ${
                      item.recommendation_status === key ? 'border-slate-400 bg-slate-50' : 'border-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500">Notes</label>
              <textarea
                value={item.notes || ''}
                onChange={(event) => onUpdateItem({ notes: event.target.value })}
                placeholder="Add inspection notes"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:ring-0"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500">Recommendation details</label>
              <textarea
                value={item.recommendation || ''}
                onChange={(event) => onUpdateItem({ recommendation: event.target.value })}
                placeholder="Suggested repairs or observations"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:ring-0"
                rows={3}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(item.suggested_for_template)}
                onChange={(event) => onUpdateItem({ suggested_for_template: event.target.checked })}
                className="rounded border-slate-300"
              />
              Suggest this item for future templates
            </label>

            <div className="rounded-xl border border-slate-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Media evidence</div>
                <span className="text-xs text-slate-500">{media.length} files</span>
              </div>
              <MediaCaptureWidget onFileSelected={onUploadItemMedia} />
              <div className="space-y-2">
                {media.length === 0 && (
                  <p className="text-xs text-slate-500">No attachments yet.</p>
                )}
                {media.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      {file.mime_type?.startsWith('image/') && (
                        <img src={file.url} alt={file.file_name} className="w-10 h-10 rounded-lg object-cover" />
                      )}
                      {file.mime_type?.startsWith('video/') && (
                        <video src={file.url} controls className="w-12 h-10 rounded-lg object-cover" />
                      )}
                      {file.mime_type?.startsWith('audio/') && (
                        <audio src={file.url} controls className="h-8 w-28" />
                      )}
                      <span className="font-medium text-slate-700">{file.file_name}</span>
                      {file.media_type && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{file.media_type}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteItemMedia(file)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
