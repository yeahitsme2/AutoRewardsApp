import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Package, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Part, PartLocation, RepairOrderMarkupRule, ShopLocation } from '../../types/database';

export interface SelectedPartInfo {
  part: Part;
  location: PartLocation | null;
  availableQty: number;
  isSpecialOrder: boolean;
  unitCost: number;
  unitPrice: number;
  markupPercent: number;
}

interface PartsPickerProps {
  shopId: string;
  markupRules: RepairOrderMarkupRule[];
  locations: ShopLocation[];
  onSelect: (info: SelectedPartInfo) => void;
  onClear: () => void;
  selectedPartId: string | null;
  selectedPartName: string;
  quantity: number;
}

interface PartWithStock extends Part {
  locations: Array<{
    location: PartLocation;
    shopLocation: ShopLocation;
    available: number;
  }>;
  totalOnHand: number;
  totalAvailable: number;
}

function getMarkupPercent(cost: number, rules: RepairOrderMarkupRule[]): number {
  for (const rule of rules) {
    if (cost >= Number(rule.min_cost) && (rule.max_cost === null || cost <= Number(rule.max_cost))) {
      return Number(rule.markup_percent);
    }
  }
  return 0;
}

export function PartsPicker({
  shopId,
  markupRules,
  locations,
  onSelect,
  onClear,
  selectedPartId,
  selectedPartName,
  quantity,
}: PartsPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartWithStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchParts = useCallback(
    async (term: string) => {
      if (!shopId) return;
      setLoading(true);
      try {
        let q = supabase
          .from('parts')
          .select('*')
          .eq('shop_id', shopId)
          .eq('is_active', true)
          .order('name');

        if (term.trim()) {
          q = q.or(
            `name.ilike.%${term}%,sku.ilike.%${term}%,internal_sku.ilike.%${term}%,category.ilike.%${term}%`
          );
        } else {
          q = q.limit(30);
        }

        const { data: partsData, error } = await q;
        if (error || !partsData) {
          setResults([]);
          return;
        }

        const partIds = partsData.map((p) => p.id);
        const { data: locData } = await supabase
          .from('part_locations')
          .select('*')
          .in('part_id', partIds);

        const locMap = new Map<string, PartLocation[]>();
        (locData || []).forEach((pl) => {
          const arr = locMap.get(pl.part_id) || [];
          arr.push(pl as PartLocation);
          locMap.set(pl.part_id, arr);
        });

        const withStock: PartWithStock[] = partsData.map((part) => {
          const partLocs = locMap.get(part.id) || [];
          const locList = partLocs
            .map((pl) => {
              const shopLoc = locations.find((l) => l.id === pl.location_id);
              if (!shopLoc) return null;
              return {
                location: pl as PartLocation,
                shopLocation: shopLoc,
                available: Math.max(0, Number(pl.on_hand) - Number(pl.reserved)),
              };
            })
            .filter(Boolean) as PartWithStock['locations'];

          const totalOnHand = partLocs.reduce((s, pl) => s + Number(pl.on_hand), 0);
          const totalAvailable = locList.reduce((s, l) => s + l.available, 0);

          return { ...(part as Part), locations: locList, totalOnHand, totalAvailable };
        });

        setResults(withStock);
      } finally {
        setLoading(false);
      }
    },
    [shopId, locations]
  );

  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchParts(query), 220);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, open, searchParts]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectPart = (part: PartWithStock) => {
    const locId = selectedLocation[part.id] || (part.locations[0]?.location.location_id ?? '');
    const loc = part.locations.find((l) => l.location.location_id === locId) || part.locations[0] || null;
    const availQty = loc ? loc.available : 0;
    const isSpecialOrder = availQty < quantity;
    const unitCost = Number(part.unit_cost);
    const markup = getMarkupPercent(unitCost, markupRules);
    const unitPrice = Math.round((unitCost * (1 + markup / 100)) * 100) / 100;

    onSelect({
      part,
      location: loc?.location ?? null,
      availableQty: availQty,
      isSpecialOrder,
      unitCost,
      unitPrice,
      markupPercent: markup,
    });
    setOpen(false);
    setQuery('');
  };

  const stockBadge = (part: PartWithStock) => {
    if (part.totalAvailable >= quantity) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {part.totalAvailable} avail
        </span>
      );
    }
    if (part.totalOnHand > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {part.totalAvailable} avail
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Out of stock
      </span>
    );
  };

  if (selectedPartId) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <Package className="w-4 h-4 text-blue-600 shrink-0" />
        <span className="text-blue-900 font-medium flex-1 truncate">{selectedPartName}</span>
        <button
          type="button"
          onClick={onClear}
          className="text-blue-400 hover:text-blue-700 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors text-left"
      >
        <Package className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="flex-1">Search parts catalog...</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, SKU, or category..."
                className="flex-1 bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Searching...</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                {query ? 'No parts found' : 'Start typing to search your parts catalog'}
              </div>
            )}
            {!loading &&
              results.map((part) => {
                const unitCost = Number(part.unit_cost);
                const markup = getMarkupPercent(unitCost, markupRules);
                const unitPrice = Math.round((unitCost * (1 + markup / 100)) * 100) / 100;
                const hasMultipleLocations = part.locations.length > 1;
                const locId = selectedLocation[part.id] || part.locations[0]?.location.location_id;

                return (
                  <div
                    key={part.id}
                    className="group px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                    onClick={() => handleSelectPart(part)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 truncate">{part.name}</span>
                          {stockBadge(part)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {part.sku && (
                            <span className="text-xs text-slate-400 font-mono">SKU: {part.sku}</span>
                          )}
                          {part.internal_sku && (
                            <span className="text-xs text-slate-400 font-mono">Int: {part.internal_sku}</span>
                          )}
                          {part.category && (
                            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{part.category}</span>
                          )}
                        </div>
                        {hasMultipleLocations && (
                          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={locId || ''}
                              onChange={(e) =>
                                setSelectedLocation((prev) => ({ ...prev, [part.id]: e.target.value }))
                              }
                              className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 bg-white"
                            >
                              {part.locations.map((l) => (
                                <option key={l.location.location_id} value={l.location.location_id}>
                                  {l.shopLocation.name} — {l.available} avail
                                  {l.location.bin ? ` (Bin: ${l.location.bin})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {part.locations.length === 1 && part.locations[0].location.bin && (
                          <div className="mt-1 text-xs text-slate-400">
                            Bin: {part.locations[0].location.bin}
                          </div>
                        )}
                        {part.totalAvailable < quantity && quantity > 0 && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            Need {quantity}, only {part.totalAvailable} available — will mark as special order
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-slate-900">${unitPrice.toFixed(2)}</div>
                        {markup > 0 && (
                          <div className="text-xs text-slate-400">
                            Cost ${unitCost.toFixed(2)} + {markup}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={() => { setOpen(false); onClear(); }}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
            >
              <Check className="w-3 h-3" />
              Enter manually instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StockStatusBadge({
  partId,
  repairOrderId,
  quantity,
  reservations,
}: {
  partId: string | null;
  repairOrderId: string;
  quantity: number;
  reservations: Array<{ part_id: string; repair_order_id: string; status: string; job_status: string | null; is_special_order: boolean; quantity: number }>;
}) {
  if (!partId) return null;

  const reservation = reservations.find(
    (r) => r.part_id === partId && r.repair_order_id === repairOrderId
  );

  if (!reservation) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Not reserved
      </span>
    );
  }

  if (reservation.status === 'consumed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Installed
      </span>
    );
  }

  if (reservation.is_special_order) {
    const label =
      reservation.job_status === 'ordered' ? 'On Order' :
      reservation.job_status === 'received' ? 'Received' :
      'Special Order';
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Reserved
    </span>
  );
}
