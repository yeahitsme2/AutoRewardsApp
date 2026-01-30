import { Search, AlertTriangle, CheckCircle, Clock3 } from 'lucide-react';

type QueueItem = {
  id: string;
  roNumber: string;
  customerLabel: string;
  status: string;
  lastUpdated: string;
  reportStatus: string | null;
  redCount: number;
  yellowCount: number;
  greenCount: number;
};

type TechnicianRoQueueProps = {
  items: QueueItem[];
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  filter: 'all' | 'open' | 'published';
  onFilterChange: (value: 'all' | 'open' | 'published') => void;
  onSelect: (id: string) => void;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  showFilters?: boolean;
  emptyMessage?: string;
};

export function TechnicianRoQueue({
  items,
  selectedId,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onSelect,
  loading,
  title = 'Open inspections',
  subtitle = 'Repair Order Queue',
  showFilters = true,
  emptyMessage = 'No repair orders match this filter.',
}: TechnicianRoQueueProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{subtitle}</p>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search RO or customer"
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-slate-400 focus:ring-0"
        />
      </div>

      {showFilters && (
        <div className="flex gap-2 text-xs font-semibold">
          {(['all', 'open', 'published'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onFilterChange(value)}
              className={`px-3 py-1 rounded-full border ${
                filter === value ? 'border-slate-400 bg-slate-50 text-slate-700' : 'border-slate-200 text-slate-500'
              }`}
            >
              {value === 'all' ? 'All' : value === 'open' ? 'Open' : 'Published'}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3 max-h-[520px] overflow-y-auto">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full text-left border rounded-2xl p-3 transition ${
              selectedId === item.id ? 'border-slate-400 shadow-sm bg-slate-50' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900">{item.roNumber}</span>
              <div className="flex items-center gap-2 text-[11px]">
                {item.reportStatus && (
                  <span className={`px-2 py-1 rounded-full ${item.reportStatus === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.reportStatus === 'published' ? 'Published' : 'Draft'}
                  </span>
                )}
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  {item.status}
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-1">{item.customerLabel}</div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                {item.lastUpdated}
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="w-3 h-3" />
                  {item.greenCount}
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  {item.yellowCount}
                </span>
                <span className="flex items-center gap-1 text-rose-600">
                  <AlertTriangle className="w-3 h-3" />
                  {item.redCount}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
