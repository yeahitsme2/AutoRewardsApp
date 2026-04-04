import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { calculateTotalsWithSupplies } from '../lib/repairOrderTotals';
import { notifyCustomer } from '../lib/notifications';
import { AlertCircle, CheckCircle, ClipboardList, ClipboardCheck, DollarSign, Plus, Save, User, Car, X, MessageSquare, Boxes, AlertTriangle, Camera, Mic, Video, Copy, RefreshCw, Tag } from 'lucide-react';
import { PartsPicker, StockStatusBadge } from './repair-orders/PartsPicker';
import type { SelectedPartInfo } from './repair-orders/PartsPicker';
import { ChatThread } from './ChatThread';
import { logAuditEvent } from '../lib/audit';
import { logOutboundMessage } from '../lib/messaging';
import { consumeReservedParts as consumeReservedPartsAction, reservePart as reservePartAction, unreservePart as unreservePartAction } from '../lib/inventory';
import { buildMediaCounts, buildRecommendations, selectLatestReport, type DviRecommendation } from '../lib/dviRecommendations';
import { getTierLevels } from '../lib/rewardsUtils';
import type { Customer, DviItemMedia, DviReport, DviReportItem, Part, RepairOrder, RepairOrderItem, RepairOrderMarkupRule, RepairOrderPartReservation, ShopLocation, ShopSettings, Vehicle } from '../types/database';

interface RepairOrderWithDetails extends RepairOrder {
  customer?: Customer;
  vehicle?: Vehicle | null;
  items?: RepairOrderItem[];
}

type QuickAddTemplate = {
  id: string;
  label: string;
  labor: {
    description: string;
    hours: number;
    unit_price: number;
  };
  parts: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
};

type RepairOrderStatus = RepairOrder['status'];

const statusOptions: RepairOrderStatus[] = ['draft', 'awaiting_approval', 'approved', 'declined', 'inspection_complete', 'closed'];

type ConfirmModalConfig = {
  title: string;
  body: string;
  confirmLabel: string;
  confirmStyle?: string;
  onConfirm: () => void;
};

const statusLabels: Record<RepairOrderStatus, string> = {
  draft: 'Draft',
  awaiting_approval: 'Awaiting Approval',
  approved: 'Approved',
  declined: 'Declined',
  inspection_complete: 'Inspection Complete',
  closed: 'Closed',
};

const statusStyles: Record<RepairOrderStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
  awaiting_approval: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  declined: { bg: 'bg-red-100', text: 'text-red-700' },
  inspection_complete: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  closed: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

const emptyItem = {
  item_type: 'labor' as RepairOrderItem['item_type'],
  description: '',
  quantity: 1,
  labor_hours: null as number | null,
  cost: 0,
  unit_price: 0,
  taxable: false,
  parent_item_id: null as string | null,
  part_id: null as string | null,
  part_cost_snapshot: null as number | null,
  customer_notes: '' as string,
};

const generateRoNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RO-${datePart}-${rand}`;
};

const roundToCents = (value: number) => Math.round(value * 100) / 100;
const getDisplayTotals = (order: RepairOrder | null) => calculateTotalsWithSupplies({
  labor_total: order?.labor_total,
  parts_total: order?.parts_total,
  fees_total: order?.fees_total,
  tax_total: order?.tax_total,
  supplies_amount: order?.supplies_amount,
});

export function RepairOrdersManagement() {
  const { admin } = useAuth();
  const { brandSettings } = useBrand();
  const [orders, setOrders] = useState<RepairOrderWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [reservations, setReservations] = useState<RepairOrderPartReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [markupRules, setMarkupRules] = useState<RepairOrderMarkupRule[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [taxableTypes, setTaxableTypes] = useState<string[]>(['part']);
  const [laborRate, setLaborRate] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [dviModalOpen, setDviModalOpen] = useState(false);
  const [dviLoading, setDviLoading] = useState(false);
  const [dviReportStatus, setDviReportStatus] = useState<'published' | 'draft' | null>(null);
  const [dviRecommendations, setDviRecommendations] = useState<{ priority: DviRecommendation[]; future: DviRecommendation[] } | null>(null);
  const [dviSelected, setDviSelected] = useState<Record<string, boolean>>({});
  const [dviSearch, setDviSearch] = useState('');
  const [dviAvailable, setDviAvailable] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<RepairOrderItem>>>({});
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );
  const selectedOrderTotals = useMemo(
    () => getDisplayTotals(selectedOrder),
    [selectedOrder]
  );
  const openOrders = useMemo(
    () => orders.filter((order) => order.status !== 'closed' && order.status !== 'inspection_complete'),
    [orders]
  );
  const inspectionCompleteOrders = useMemo(
    () => orders.filter((order) => order.status === 'inspection_complete'),
    [orders]
  );
  const pastOrders = useMemo(
    () => orders.filter((order) => order.status === 'closed'),
    [orders]
  );
  const awaitingApprovalCount = useMemo(
    () => orders.filter((order) => order.status === 'awaiting_approval').length,
    [orders]
  );
  const filteredPriority = useMemo(() => {
    if (!dviRecommendations) return [];
    if (!dviSearch.trim()) return dviRecommendations.priority;
    const term = dviSearch.toLowerCase();
    return dviRecommendations.priority.filter((item) =>
      item.title.toLowerCase().includes(term) || (item.notes || '').toLowerCase().includes(term)
    );
  }, [dviRecommendations, dviSearch]);

  const filteredFuture = useMemo(() => {
    if (!dviRecommendations) return [];
    if (!dviSearch.trim()) return dviRecommendations.future;
    const term = dviSearch.toLowerCase();
    return dviRecommendations.future.filter((item) =>
      item.title.toLowerCase().includes(term) || (item.notes || '').toLowerCase().includes(term)
    );
  }, [dviRecommendations, dviSearch]);

  const laborLineItems = useMemo(() => {
    if (!selectedOrder?.items) return [];
    return selectedOrder.items.filter((item) => item.item_type === 'labor' && !item.parent_item_id);
  }, [selectedOrder]);

  const nestedLineItems = useMemo(() => {
    if (!selectedOrder?.items) return [];
    const parents = selectedOrder.items.filter((item) => !item.parent_item_id);
    const childrenMap = new Map<string, RepairOrderItem[]>();
    selectedOrder.items.forEach((item) => {
      if (!item.parent_item_id) return;
      const list = childrenMap.get(item.parent_item_id) || [];
      list.push(item);
      childrenMap.set(item.parent_item_id, list);
    });
    return parents.map((parent) => ({
      item: parent,
      children: (childrenMap.get(parent.id) || []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }));
  }, [selectedOrder]);

  const selectedCount = useMemo(() => {
    if (!dviRecommendations) return 0;
    const items = [...dviRecommendations.priority, ...dviRecommendations.future];
    return items.filter((item) => dviSelected[item.id] && !item.alreadyAdded).length;
  }, [dviRecommendations, dviSelected]);
  const quickAddTemplates = useMemo<QuickAddTemplate[]>(() => ([
    {
      id: 'oil-change',
      label: 'Oil Change',
      labor: { description: 'Oil change labor', hours: 0.5, unit_price: laborRate },
      parts: [
        { description: 'Oil filter', quantity: 1, unit_price: 8 },
        { description: 'Engine oil', quantity: 5, unit_price: 6 },
      ],
    },
    {
      id: 'brake-service',
      label: 'Brake Service',
      labor: { description: 'Brake service labor', hours: 1.5, unit_price: laborRate },
      parts: [
        { description: 'Brake pads', quantity: 1, unit_price: 85 },
        { description: 'Brake rotors', quantity: 2, unit_price: 110 },
      ],
    },
    {
      id: 'tire-rotation',
      label: 'Tire Rotation',
      labor: { description: 'Tire rotation labor', hours: 0.6, unit_price: laborRate },
      parts: [],
    },
  ]), [laborRate]);
  const [newOrder, setNewOrder] = useState({
    customer_id: '',
    vehicle_id: '',
    internal_notes: '',
  });
  const [itemDrafts, setItemDrafts] = useState<Record<string, typeof emptyItem>>({});
  const restoredDraftsRef = useRef<Set<string>>(new Set());
  const [reservationDraft, setReservationDraft] = useState({
    part_id: '',
    location_id: '',
    quantity: 1,
    is_special_order: false,
  });
  const [showChat, setShowChat] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadItemsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadDviTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOrderIdRef = useRef<string | null>(null);
  const selectedOrderRef = useRef<RepairOrderWithDetails | null>(null);
  const scheduleReload = () => {
    if (reloadTimerRef.current) return;
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      loadOrders();
    }, 400);
  };
  const scheduleItemsReload = (orderId: string | null) => {
    if (!orderId || reloadItemsTimerRef.current) return;
    reloadItemsTimerRef.current = setTimeout(() => {
      reloadItemsTimerRef.current = null;
      loadItems(orderId).catch((error) => console.error('Failed to reload line items:', error));
    }, 300);
  };
  const scheduleDviReload = () => {
    if (reloadDviTimerRef.current) return;
    reloadDviTimerRef.current = setTimeout(() => {
      reloadDviTimerRef.current = null;
      const order = selectedOrderRef.current;
      if (!order) return;
      checkDviAvailability(order.id);
      if (dviModalOpen) {
        loadDviRecommendations(order).catch((error) => console.error('Failed to reload DVI:', error));
      }
    }, 400);
  };

  const getDraftStorageKey = (orderId: string) => `ro-draft-${admin?.shop_id || 'shop'}-${orderId}`;

  useEffect(() => {
    if (!selectedOrderId) return;
    if (restoredDraftsRef.current.has(selectedOrderId)) return;
    const raw = localStorage.getItem(getDraftStorageKey(selectedOrderId));
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as {
        itemDraft?: typeof emptyItem;
        editDrafts?: Record<string, Partial<RepairOrderItem>>;
      };
      if (payload.itemDraft) {
        setItemDrafts((prev) => ({
          ...prev,
          [selectedOrderId]: { ...emptyItem, ...payload.itemDraft },
        }));
      }
      if (payload.editDrafts) {
        setEditDrafts((prev) => ({ ...prev, ...payload.editDrafts }));
      }
      restoredDraftsRef.current.add(selectedOrderId);
      showMessage('success', 'Restored draft changes');
    } catch (error) {
      console.warn('Failed to restore draft:', error);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) return;
    const orderItems = selectedOrder?.items || [];
    const editDraftsForOrder = orderItems.reduce<Record<string, Partial<RepairOrderItem>>>((acc, item) => {
      if (editDrafts[item.id]) acc[item.id] = editDrafts[item.id];
      return acc;
    }, {});
    const draft = itemDrafts[selectedOrderId];
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(
          getDraftStorageKey(selectedOrderId),
          JSON.stringify({ itemDraft: draft, editDrafts: editDraftsForOrder })
        );
      } catch (error) {
        console.warn('Failed to save draft:', error);
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [selectedOrderId, itemDrafts, editDrafts, selectedOrder?.items]);

  useEffect(() => {
    loadOrders();
    loadCustomers();
    loadVehicles();
    loadMarkupRules();
    loadTaxSettings();
    loadParts();
    loadLocations();
    const channel = supabase
      .channel('ro-admin-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repair_orders' },
        (payload) => {
          scheduleReload();
          const orderId = (payload.new as RepairOrder | null)?.id || (payload.old as RepairOrder | null)?.id || null;
          if (orderId && orderId === selectedOrderIdRef.current) {
            scheduleItemsReload(orderId);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repair_order_items' },
        (payload) => {
          scheduleReload();
          const orderId = (payload.new as RepairOrderItem | null)?.repair_order_id
            || (payload.old as RepairOrderItem | null)?.repair_order_id
            || null;
          if (orderId && orderId === selectedOrderIdRef.current) {
            scheduleItemsReload(orderId);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dvi_reports' },
        (payload) => {
          const orderId = (payload.new as DviReport | null)?.repair_order_id
            || (payload.old as DviReport | null)?.repair_order_id
            || null;
          if (orderId && orderId === selectedOrderIdRef.current) {
            scheduleDviReload();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dvi_report_items' },
        () => {
          if (selectedOrderIdRef.current) {
            scheduleDviReload();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dvi_item_media' },
        () => {
          if (selectedOrderIdRef.current) {
            scheduleDviReload();
          }
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      if (reloadItemsTimerRef.current) {
        clearTimeout(reloadItemsTimerRef.current);
        reloadItemsTimerRef.current = null;
      }
      if (reloadDviTimerRef.current) {
        clearTimeout(reloadDviTimerRef.current);
        reloadDviTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    selectedOrderIdRef.current = selectedOrderId;
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrderId, selectedOrder]);

  useEffect(() => {
    if (!selectedOrderId) {
      setDviAvailable(false);
      return;
    }
    checkDviAvailability(selectedOrderId);
  }, [selectedOrderId]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const statusMapRef = useRef<Record<string, RepairOrder['status']>>({});

  useEffect(() => {
    if (!selectedOrderId) return;
    setItemDrafts((prev) => {
      if (prev[selectedOrderId]) return prev;
      return {
        ...prev,
        [selectedOrderId]: {
          ...emptyItem,
          taxable: taxableTypes.includes('part'),
          unit_price: laborRate,
        },
      };
    });
  }, [selectedOrderId, taxableTypes, laborRate]);


  const loadOrders = async () => {
    try {
      setLoading(true);
      const { data: ordersData, error } = await supabase
        .from('repair_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        const notFound = error.code === '42P01'
          || error.code === '404'
          || error.message?.includes('repair_orders')
          || error.message?.includes('Not Found');
        if (notFound) {
          setTableMissing(true);
          setOrders([]);
          return;
        }
        throw error;
      }

      const ordersList = (ordersData || []) as RepairOrder[];
      const customerIds = [...new Set(ordersList.map((o) => o.customer_id))];
      const vehicleIds = [...new Set(ordersList.map((o) => o.vehicle_id).filter(Boolean) as string[])];

      const [customersRes, vehiclesRes] = await Promise.all([
        customerIds.length > 0 ? supabase.from('customers').select('*').in('id', customerIds) : Promise.resolve({ data: [], error: null }),
        vehicleIds.length > 0 ? supabase.from('vehicles').select('*').in('id', vehicleIds) : Promise.resolve({ data: [], error: null }),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      const nextOrders: RepairOrderWithDetails[] = ordersList.map((order) => ({
        ...order,
        customer: customersRes.data?.find((cust) => cust.id === order.customer_id),
        vehicle: vehiclesRes.data?.find((veh) => veh.id === order.vehicle_id) || null,
      }));

      const nextMap: Record<string, RepairOrder['status']> = {};
      nextOrders.forEach((order) => {
        nextMap[order.id] = order.status;
      });

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        nextOrders.forEach((order) => {
          const prevStatus = statusMapRef.current[order.id];
          if (prevStatus && prevStatus !== order.status && (order.status === 'approved' || order.status === 'declined')) {
            new Notification('Repair Order Update', {
              body: `${order.ro_number} ${order.status.replace('_', ' ')}`,
              icon: '/favicon.ico',
            });
          }
        });
      }

      statusMapRef.current = nextMap;
      setOrders(nextOrders);
    } catch (error) {
      console.error('Error loading repair orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDviAvailability = async (orderId: string) => {
    try {
      setDviAvailable(false);
      const { data, error } = await supabase
        .from('dvi_reports')
        .select('id,status,created_at')
        .eq('repair_order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      setDviAvailable((data || []).length > 0);
    } catch (error) {
      console.error('Failed to check DVI availability:', error);
      setDviAvailable(false);
    }
  };

  const loadDviRecommendations = async (order: RepairOrderWithDetails) => {
    setDviLoading(true);
    try {
      const { data: reports, error: reportError } = await supabase
        .from('dvi_reports')
        .select('*')
        .eq('repair_order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (reportError) throw reportError;
      const report = selectLatestReport((reports || []) as DviReport[]);
      if (!report) {
        setDviRecommendations(null);
        setDviReportStatus(null);
        setDviAvailable(false);
        return;
      }
      setDviAvailable(true);
      setDviReportStatus(report.status === 'published' ? 'published' : 'draft');

      const { data: items, error: itemsError } = await supabase
        .from('dvi_report_items')
        .select('*')
        .eq('report_id', report.id)
        .order('created_at', { ascending: true });
      if (itemsError) throw itemsError;

      const reportItems = (items || []) as DviReportItem[];
      const itemIds = reportItems.map((item) => item.id);

      const { data: mediaRows, error: mediaError } = await supabase
        .from('dvi_item_media')
        .select('*')
        .in('report_item_id', itemIds.length > 0 ? itemIds : ['00000000-0000-0000-0000-000000000000']);
      if (mediaError) throw mediaError;
      const mediaCounts = buildMediaCounts((mediaRows || []) as DviItemMedia[]);

      const { data: existingRows, error: existingError } = await supabase
        .from('repair_order_items')
        .select('source_id')
        .eq('repair_order_id', order.id)
        .eq('source_type', 'dvi');
      if (existingError) throw existingError;
      const existingIds = new Set((existingRows || []).map((row) => row.source_id).filter(Boolean) as string[]);

      const grouped = buildRecommendations(report.id, reportItems, mediaCounts, existingIds);
      setDviRecommendations(grouped);
      setDviSelected({});
    } catch (error) {
      console.error('Failed to load DVI recommendations:', error);
      setDviRecommendations(null);
    } finally {
      setDviLoading(false);
    }
  };

  const handleAddDviItems = async (order: RepairOrderWithDetails) => {
    if (!dviRecommendations) return;
    const selectedItems = [...dviRecommendations.priority, ...dviRecommendations.future]
      .filter((item) => dviSelected[item.id] && !item.alreadyAdded);
    if (selectedItems.length === 0) {
      showMessage('error', 'Select at least one recommendation');
      return;
    }
    try {
      const newRows = selectedItems.map((item) => {
        const unitPriceValue = laborRate;
        return {
          repair_order_id: order.id,
          item_type: 'labor' as RepairOrderItem['item_type'],
          description: `${item.title}${item.notes ? ` - ${item.notes}` : ''}`,
          quantity: 1,
          labor_hours: null,
          unit_price: unitPriceValue,
          total: 0,
          taxable: false,
          status: 'pending',
          source_type: 'dvi',
          source_id: item.id,
          metadata: {
            dvi_report_id: item.reportId,
            condition: item.condition,
            recommendation_status: item.recommendationStatus,
          },
        };
      });
      const { data, error } = await supabase
        .from('repair_order_items')
        .insert(newRows)
        .select('*');
      if (error) throw error;

      setOrders((prev) =>
        prev.map((current) => {
          if (current.id !== order.id) return current;
          return { ...current, items: [...(current.items || []), ...((data || []) as RepairOrderItem[])] };
        })
      );

      const updatedOrder = orders.find((current) => current.id === order.id);
      const nextItems = [...(updatedOrder?.items || []), ...((data || []) as RepairOrderItem[])];
      await updateOrderTotals(order.id, nextItems);

      showMessage('success', `Added ${selectedItems.length} items from DVI`);
      setDviModalOpen(false);
      setDviSelected({});
    } catch (error) {
      console.error('Failed to add DVI items:', error);
      showMessage('error', 'Failed to add DVI items');
    }
  };

  const loadCustomers = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('full_name', { ascending: true });
    if (!error) setCustomers((data || []) as Customer[]);
  };

  const loadVehicles = async () => {
    if (!admin?.shop_id) return;
    const { data: customerRows, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('shop_id', admin.shop_id);
    if (customerError) return;
    const customerIds = (customerRows || []).map((c) => c.id);
    if (customerIds.length === 0) {
      setVehicles([]);
      return;
    }
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false });
    if (!error) setVehicles((data || []) as Vehicle[]);
  };

  const loadParts = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('created_at', { ascending: false });
    if (!error) setParts((data || []) as Part[]);
  };

  const loadLocations = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('shop_locations')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (!error) setLocations((data || []) as ShopLocation[]);
  };

  const loadReservations = async (orderId: string) => {
    const { data, error } = await supabase
      .from('repair_order_part_reservations')
      .select('*')
      .eq('repair_order_id', orderId);
    if (!error) setReservations((data || []) as RepairOrderPartReservation[]);
  };

  const reservePart = async (orderId: string) => {
    if (!admin?.shop_id) return;
    if (!reservationDraft.part_id || reservationDraft.quantity <= 0) {
      showMessage('error', 'Select part and quantity');
      return;
    }
    if (!reservationDraft.is_special_order && !reservationDraft.location_id) {
      showMessage('error', 'Select a location for stock parts');
      return;
    }
    try {
      const reservation = await reservePartAction({
        shopId: admin.shop_id,
        orderId,
        partId: reservationDraft.part_id,
        locationId: reservationDraft.location_id,
        quantity: Number(reservationDraft.quantity),
        isSpecialOrder: reservationDraft.is_special_order,
      });
      setReservationDraft({ part_id: '', location_id: '', quantity: 1, is_special_order: false });
      setReservations((prev) => [...prev, reservation]);
      showMessage('success', 'Part reserved');
    } catch (error) {
      console.error('Error reserving part:', error);
      showMessage('error', 'Failed to reserve part');
    }
  };

  const consumeReservedParts = async (orderId: string) => {
    if (!admin?.shop_id) return;
    try {
      await consumeReservedPartsAction({
        shopId: admin.shop_id,
        orderId,
        reservations,
      });
      setReservations((prev) =>
        prev.map((res) => (res.repair_order_id === orderId && res.status === 'reserved'
          ? { ...res, status: 'consumed', job_status: 'installed' }
          : res))
      );
    } catch (error) {
      console.error('Error consuming reserved parts:', error);
    }
  };

  const handleUnreservePart = async (reservation: RepairOrderPartReservation) => {
    if (!admin?.shop_id) return;
    if (reservation.status === 'consumed') {
      showMessage('error', 'Cannot unreserve a part that has already been installed');
      return;
    }
    try {
      await unreservePartAction({
        shopId: admin.shop_id,
        reservationId: reservation.id,
        partId: reservation.part_id,
        locationId: reservation.location_id,
        quantity: reservation.quantity,
        orderId: reservation.repair_order_id,
        isSpecialOrder: Boolean(reservation.is_special_order),
      });
      setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
      showMessage('success', 'Part unreserved');
    } catch (error) {
      console.error('Error unreserving part:', error);
      showMessage('error', 'Failed to unreserve part');
    }
  };

  const loadMarkupRules = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('repair_order_markup_rules')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .eq('is_active', true);
    if (error) {
      const missing = error.code === '42P01' || error.message?.includes('repair_order_markup_rules');
      if (!missing) {
        console.error('Error loading markup rules:', error);
      }
      setMarkupRules([]);
      return;
    }
    const sorted = (data || []).slice().sort((a, b) => Number(b.min_cost) - Number(a.min_cost));
    setMarkupRules(sorted as RepairOrderMarkupRule[]);
  };

  const loadTaxSettings = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('shop_settings')
      .select('tax_rate, taxable_item_types, labor_rate')
      .eq('shop_id', admin.shop_id)
      .maybeSingle();
    if (error) {
      console.error('Error loading tax settings:', error);
      return;
    }
    const settings = data as ShopSettings | null;
    setTaxRate(Number(settings?.tax_rate || 0));
    setTaxableTypes((settings?.taxable_item_types as string[]) || ['part']);
    setLaborRate(Number(settings?.labor_rate || 0));
  };

  const startEditItem = (item: RepairOrderItem) => {
    setEditingItemId(item.id);
    setEditDrafts((prev) => ({
      ...prev,
      [item.id]: {
        description: item.description,
        item_type: item.item_type,
        quantity: item.quantity,
        labor_hours: item.labor_hours,
        unit_price: item.unit_price,
        taxable: item.taxable,
        parent_item_id: item.parent_item_id || null,
        customer_notes: (item as any).customer_notes || '',
      },
    }));
  };

  const updateEditDraft = (itemId: string, patch: Partial<RepairOrderItem>) => {
    setEditDrafts((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  };

  const cancelEdit = () => {
    setEditingItemId(null);
  };

  const saveEdit = async (orderId: string, itemId: string) => {
    const draft = editDrafts[itemId];
    if (!draft?.description) {
      showMessage('error', 'Description is required');
      return;
    }
    const isLabor = draft.item_type === 'labor';
    const quantityValue = isLabor ? 1 : Number(draft.quantity || 0);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      showMessage('error', 'Quantity must be greater than 0');
      return;
    }
    if (isLabor && (draft.labor_hours === null || draft.labor_hours === undefined)) {
      showMessage('error', 'Enter labor hours for labor line items');
      return;
    }
    const unitPriceValue = roundToCents(Number(draft.unit_price || 0));
    const total = roundToCents((isLabor ? Number(draft.labor_hours || 0) : quantityValue) * unitPriceValue);

    try {
      const { data, error } = await supabase
        .from('repair_order_items')
        .update({
          description: draft.description,
          quantity: quantityValue,
          labor_hours: isLabor ? draft.labor_hours : null,
          unit_price: unitPriceValue,
          total,
          taxable: Boolean(draft.taxable),
          status: draft.status || 'pending',
          parent_item_id: draft.parent_item_id || null,
          customer_notes: (draft as any).customer_notes?.trim() || null,
        })
        .eq('id', itemId)
        .select('*')
        .single();
      if (error) throw error;

      const currentOrder = orders.find((order) => order.id === orderId);
      const nextItems = (currentOrder?.items || []).map((item) => (item.id === itemId ? (data as RepairOrderItem) : item));
      const totals = computeTotals(nextItems);

      // Update state with both items and totals in one update
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          return { ...order, items: nextItems, ...totals };
        })
      );

      // Persist totals to database
      try {
        const { error: updateError } = await supabase
          .from('repair_orders')
          .update({ ...totals, updated_at: new Date().toISOString() })
          .eq('id', orderId);
        if (updateError) console.error('Failed to persist totals:', updateError);
      } catch (err) {
        console.error('Failed to persist totals:', err);
      }

      setEditingItemId(null);
      delete editDrafts[itemId];
      showMessage('success', 'Item updated');
    } catch (error) {
      console.error('Failed to update line item:', error);
      showMessage('error', 'Failed to update line item');
    }
  };

  const handleDeleteLineItem = async (orderId: string, itemId: string) => {
    const currentOrder = orders.find((order) => order.id === orderId);
    if (!currentOrder) return;

    const previousItems = currentOrder.items || [];
    const nextItems = (currentOrder.items || []).filter((item) =>
      item.id !== itemId && item.parent_item_id !== itemId
    );
    const totals = computeTotals(nextItems);

    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        return { ...order, items: nextItems, ...totals };
      })
    );

    try {
      const linkedReservations = reservations.filter(
        (r) => r.repair_order_item_id === itemId && r.status !== 'consumed'
      );
      for (const res of linkedReservations) {
        try {
          await unreservePartAction({
            shopId: admin!.shop_id!,
            reservationId: res.id,
            partId: res.part_id,
            locationId: res.location_id,
            quantity: res.quantity,
            orderId: orderId,
            isSpecialOrder: Boolean(res.is_special_order),
          });
        } catch (unreserveErr) {
          console.warn('Failed to unreserve part on item delete:', unreserveErr);
        }
      }

      const { error } = await supabase.from('repair_order_items').delete().eq('id', itemId);
      if (error) {
        console.error('Delete error details:', error);
        setOrders((prev) =>
          prev.map((order) => {
            if (order.id !== orderId) return order;
            return { ...order, items: previousItems, ...computeTotals(previousItems) };
          })
        );
        showMessage('error', `Failed to delete: ${error.message || 'Unknown error'}`);
        return;
      }

      if (linkedReservations.length > 0) {
        setReservations((prev) => prev.filter((r) => !linkedReservations.some((lr) => lr.id === r.id)));
      }

      await supabase
        .from('repair_orders')
        .update({ ...totals, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      showMessage('success', 'Line item deleted');
    } catch (error) {
      console.error('Failed to delete line item:', error);
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          return { ...order, items: previousItems, ...computeTotals(previousItems) };
        })
      );
      showMessage('error', 'Failed to delete line item');
    }
  };

  const getMarkupPercent = (cost: number) => {
    if (!markupRules.length) return 0;
    const rule = markupRules.find((r) => {
      const min = Number(r.min_cost || 0);
      const max = r.max_cost === null ? null : Number(r.max_cost);
      return cost >= min && (max === null || cost <= max);
    });
    return rule ? Number(rule.markup_percent || 0) : 0;
  };

  const loadItems = async (orderId: string) => {
    const { data, error } = await supabase
      .from('repair_order_items')
      .select('*')
      .eq('repair_order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('repair_order_items')) {
        setTableMissing(true);
        return;
      }
      throw error;
    }

    const items = (data || []) as RepairOrderItem[];
    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, items } : order))
    );
  };

  const computeLineTotal = (item: RepairOrderItem) => {
    const lineTotal = item.item_type === 'labor'
      ? Number(item.labor_hours || 0) * Number(item.unit_price || 0)
      : Number(item.quantity || 0) * Number(item.unit_price || 0);
    return roundToCents(lineTotal);
  };

  const computeTotals = (items: RepairOrderItem[]) => {
    const eligible = items.filter((i) => i.status !== 'declined');
    const labor_total = eligible
      .filter((i) => i.item_type === 'labor')
      .reduce((sum, i) => sum + computeLineTotal(i), 0);
    const parts_total = eligible
      .filter((i) => i.item_type === 'part')
      .reduce((sum, i) => sum + computeLineTotal(i), 0);
    const fees_total = eligible
      .filter((i) => i.item_type === 'fee' || i.item_type === 'discount')
      .reduce((sum, i) => {
        const lineTotal = computeLineTotal(i);
        return i.item_type === 'discount' ? sum - Math.abs(lineTotal) : sum + lineTotal;
      }, 0);
    const taxableSubtotal = eligible.filter((i) => i.taxable).reduce((sum, i) => sum + computeLineTotal(i), 0);
    const tax_total = roundToCents(taxableSubtotal * (taxRate / 100));
    const grand_total = roundToCents(labor_total + parts_total + fees_total + tax_total);
    return { labor_total, parts_total, fees_total, tax_total, grand_total };
  };


  const updateOrderTotals = async (orderId: string, items: RepairOrderItem[]) => {
    try {
      const totals = computeTotals(items);

      // Update state immediately for real-time UI feedback
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, ...totals } : order))
      );

      // Then persist to database
      const { error } = await supabase
        .from('repair_orders')
        .update({ ...totals, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update order totals:', error);
    }
  };

  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setReservations([]);
    const order = orders.find((o) => o.id === orderId);
    if (order && !order.items) {
      try {
        await loadItems(orderId);
      } catch (error) {
        console.error('Error loading RO items:', error);
      }
    }
    await loadReservations(orderId);
  };

  const requestStatusChange = (orderId: string, status: RepairOrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const totals = getDisplayTotals(order);
    const customer = order.customer;

    if (status === 'awaiting_approval') {
      setConfirmModal({
        title: 'Send Estimate for Approval',
        body: `Send this ${totals.grand_total.toFixed(2) !== '0.00' ? `$${totals.grand_total.toFixed(2)} ` : ''}estimate to ${customer?.full_name || 'the customer'} for review? They will be notified and can approve or decline.`,
        confirmLabel: 'Send to Customer',
        confirmStyle: 'bg-yellow-500 hover:bg-yellow-600 text-white',
        onConfirm: () => { setConfirmModal(null); handleStatusChange(orderId, status); },
      });
    } else if (status === 'closed') {
      setConfirmModal({
        title: 'Close Repair Order',
        body: `Closing this RO will consume reserved parts, award loyalty points, and send a pickup notification to ${customer?.full_name || 'the customer'}. This cannot be undone.`,
        confirmLabel: 'Close RO',
        confirmStyle: 'bg-slate-700 hover:bg-slate-800 text-white',
        onConfirm: () => { setConfirmModal(null); handleStatusChange(orderId, status); },
      });
    } else {
      handleStatusChange(orderId, status);
    }
  };

  const handleStatusChange = async (orderId: string, status: RepairOrderStatus) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      const isMissingColumn = (err: { code?: string; message?: string }) =>
        err?.code === '42703'
        || err?.code === 'PGRST204'
        || (typeof err?.message === 'string' && err.message.includes('does not exist'));
      const updates: Partial<RepairOrder> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'approved') {
        updates.approved_at = new Date().toISOString();
        updates.approved_by = admin?.id || null;
      }
      if (status === 'awaiting_approval') {
        updates.customer_notified_at = new Date().toISOString();
      }
      if (status === 'closed') updates.closed_at = new Date().toISOString();

      const { error } = await supabase
        .from('repair_orders')
        .update(updates)
        .eq('id', orderId);
      if (error) {
        console.error('Update error details:', error);
        const errorMessage = error.message || error.details || error.hint || 'Failed to update repair order';
        throw new Error(errorMessage);
      }

      if (status === 'awaiting_approval' && order?.customer_id) {
        await notifyCustomer({
          shopId: order.shop_id,
          customerId: order.customer_id,
          title: 'Repair Order Ready',
          body: `${order.ro_number} is ready for your approval`,
          entityType: 'repair_order',
          entityId: orderId,
          actionUrl: '/?tab=repair_orders',
        });
        if (admin?.shop_id) {
          await logOutboundMessage({
            shopId: admin.shop_id,
            customerId: order.customer_id,
            channel: 'email',
            subject: 'Estimate ready for approval',
            body: `Your estimate ${order.ro_number} is ready for review.`,
            status: 'queued',
          });
        }
      }

      if (status === 'closed') {
        try {
          let mileageValue: number | null = null;
          const { data: mileageRow, error: mileageError } = await supabase
            .from('dvi_reports')
            .select('mileage_at_service, created_at')
            .eq('repair_order_id', orderId)
            .not('mileage_at_service', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mileageError) {
            console.warn('Failed to load DVI mileage:', mileageError);
          } else if (mileageRow?.mileage_at_service !== null && mileageRow?.mileage_at_service !== undefined) {
            const parsedMileage = Number(mileageRow.mileage_at_service);
            mileageValue = Number.isFinite(parsedMileage) ? parsedMileage : null;
          }
          const items = order?.items
            || (await supabase
              .from('repair_order_items')
              .select('*')
              .eq('repair_order_id', orderId)
              .order('created_at', { ascending: true }))
              .data
            || [];
          const totals = computeTotals(items as RepairOrderItem[]);
          const suppliesAmount = Number(order?.supplies_amount || 0);
          const preTaxTotal = roundToCents(totals.labor_total + totals.parts_total + totals.fees_total + suppliesAmount);

          const { data: settingsData } = await supabase
            .from('shop_settings')
            .select('points_per_dollar, bronze_multiplier, silver_multiplier, gold_multiplier, platinum_multiplier, silver_points_min, gold_points_min, platinum_points_min')
            .eq('shop_id', order?.shop_id || admin?.shop_id || '')
            .maybeSingle();

          if (order?.customer_id) {
            const { data: customerData } = await supabase
              .from('customers')
              .select('*')
              .eq('id', order.customer_id)
              .maybeSingle();

            if (customerData && settingsData) {
              const tierLevels = getTierLevels({
                points_per_dollar: Number(settingsData.points_per_dollar || 0),
                bronze_multiplier: Number(settingsData.bronze_multiplier || 1),
                silver_multiplier: Number(settingsData.silver_multiplier || 1),
                gold_multiplier: Number(settingsData.gold_multiplier || 1),
                platinum_multiplier: Number(settingsData.platinum_multiplier || 1),
                silver_points_min: Number(settingsData.silver_points_min || 0),
                gold_points_min: Number(settingsData.gold_points_min || 0),
                platinum_points_min: Number(settingsData.platinum_points_min || 0),
              });

              const currentTier = tierLevels[customerData.tier] || tierLevels.bronze;
              const pointsEarned = Math.floor(preTaxTotal * Number(settingsData.points_per_dollar || 0) * currentTier.multiplier);
              const nextPoints = Number(customerData.reward_points || 0) + pointsEarned;

              const sortedTiers = Object.values(tierLevels).sort((a, b) => b.minPoints - a.minPoints);
              const nextTier = sortedTiers.find((tier) => nextPoints >= tier.minPoints) || tierLevels.bronze;

              let shouldAwardPoints = true;
              const { data: existingService } = await supabase
                .from('services')
                .select('id')
                .eq('source_type', 'repair_order')
                .eq('source_id', orderId)
                .maybeSingle();

              if (existingService) {
                shouldAwardPoints = false;
              }

              if (!existingService) {
                const { data: legacyService } = await supabase
                  .from('services')
                  .select('id')
                  .eq('customer_id', order.customer_id)
                  .eq('service_type', 'Repair Order')
                  .eq('description', `Repair Order ${order.ro_number}`)
                  .maybeSingle();
                if (legacyService) {
                  shouldAwardPoints = false;
                }
              }

              if (shouldAwardPoints) {
                const servicePayload = {
                  shop_id: order.shop_id,
                  customer_id: order.customer_id,
                  vehicle_id: order.vehicle_id,
                  service_type: 'Repair Order',
                  description: `Repair Order ${order.ro_number}`,
                  amount: preTaxTotal,
                  points_earned: pointsEarned,
                  service_date: new Date().toISOString(),
                  mileage_at_service: Number.isFinite(mileageValue as number) ? mileageValue : null,
                  source_type: 'repair_order',
                  source_id: orderId,
                };

                const primaryInsert = await supabase.from('services').insert(servicePayload);
                if (primaryInsert.error && isMissingColumn(primaryInsert.error)) {
                  const fallbackPayload = {
                    shop_id: order.shop_id,
                    customer_id: order.customer_id,
                    vehicle_id: order.vehicle_id,
                    service_type: 'Repair Order',
                    description: `Repair Order ${order.ro_number}`,
                    amount: preTaxTotal,
                    points_earned: pointsEarned,
                    service_date: new Date().toISOString(),
                  };
                  const fallbackInsert = await supabase.from('services').insert(fallbackPayload);
                  if (fallbackInsert.error) throw fallbackInsert.error;
                } else if (primaryInsert.error) {
                  throw primaryInsert.error;
                }
              }

              if (shouldAwardPoints) {
                const customerUpdate = await supabase
                  .from('customers')
                  .update({
                    reward_points: nextPoints,
                    tier: nextTier.name,
                    tier_multiplier: nextTier.multiplier,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', order.customer_id);
                if (customerUpdate.error && isMissingColumn(customerUpdate.error)) {
                  const fallbackUpdate = await supabase
                    .from('customers')
                    .update({
                      reward_points: nextPoints,
                      tier: nextTier.name,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', order.customer_id);
                  if (fallbackUpdate.error) throw fallbackUpdate.error;
                } else if (customerUpdate.error) {
                  throw customerUpdate.error;
                }
              }
            }
          }

          if (order?.vehicle_id && Number.isFinite(mileageValue as number)) {
            await supabase
              .from('vehicles')
              .update({
                current_mileage: mileageValue,
                last_service_mileage: mileageValue,
                last_service_date: new Date().toISOString(),
              })
              .eq('id', order.vehicle_id);
          }
        } catch (innerError) {
          console.error('Failed to sync repair order to service history:', innerError);
        }
        await consumeReservedParts(orderId);
        if (admin?.shop_id && order?.customer_id) {
          await logOutboundMessage({
            shopId: admin.shop_id,
            customerId: order.customer_id,
            channel: 'email',
            subject: 'Your vehicle is ready',
            body: `Repair order ${order.ro_number} is completed. Please contact the shop to arrange pickup.`,
            status: 'queued',
          });
        }
      }

      if (admin?.shop_id) {
        await logAuditEvent({
          shopId: admin.shop_id,
          actorRole: 'admin',
          eventType: 'repair_order_status_updated',
          entityType: 'repair_order',
          entityId: orderId,
          metadata: { status },
        });
      }

      showMessage('success', 'Repair order updated');
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, ...updates } as RepairOrderWithDetails : order))
      );
    } catch (error) {
      console.error('Error updating RO status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update repair order';
      showMessage('error', errorMessage);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      const { error: itemError } = await supabase
        .from('repair_order_items')
        .update({ status: 'approved' })
        .eq('repair_order_id', orderId)
        .eq('status', 'pending');
      if (itemError) throw itemError;
      await handleStatusChange(orderId, 'approved');
      showMessage('success', 'Repair order approved');
    } catch (error) {
      console.error('Error approving repair order:', error);
      showMessage('error', 'Failed to approve repair order');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    const confirmed = window.confirm('Delete this repair order? This cannot be undone.');
    if (!confirmed) return;

    try {
      const { data, error } = await supabase.rpc('delete_repair_order_with_items', {
        p_repair_order_id: orderId
      });

      if (error) {
        console.error('Delete error details:', error);
        const errorMessage = error.message || error.details || error.hint || 'Failed to delete repair order';
        showMessage('error', errorMessage);
        return;
      }

      const result = data as { success: boolean; error?: string } | null;
      if (result && !result.success) {
        showMessage('error', result.error || 'Failed to delete repair order');
        return;
      }

      if (selectedOrderId === orderId) {
        setSelectedOrderId(null);
      }

      setOrders((prev) => prev.filter((order) => order.id !== orderId));

      try {
        localStorage.removeItem(getDraftStorageKey(orderId));
      } catch (e) {
        console.warn('Failed to remove draft from localStorage:', e);
      }

      showMessage('success', 'Repair order deleted');
    } catch (error) {
      console.error('Error deleting repair order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete repair order';
      showMessage('error', errorMessage);
    }
  };
  const handleDuplicateOrder = async (orderId: string) => {
    if (!admin?.shop_id) return;
    setDuplicating(true);
    try {
      const source = orders.find((o) => o.id === orderId);
      if (!source) return;
      const now = new Date().toISOString();
      const { data: newRo, error: roError } = await supabase
        .from('repair_orders')
        .insert({
          shop_id: admin.shop_id,
          customer_id: source.customer_id,
          vehicle_id: source.vehicle_id || null,
          status: 'draft',
          ro_number: generateRoNumber(),
          internal_notes: source.internal_notes || null,
          labor_total: 0,
          parts_total: 0,
          fees_total: 0,
          tax_total: 0,
          grand_total: 0,
          created_at: now,
          updated_at: now,
          customer_notified_at: null,
        })
        .select('*')
        .single();
      if (roError) throw roError;

      const sourceItems = source.items || [];
      if (sourceItems.length > 0) {
        const parentItems = sourceItems.filter((i) => !i.parent_item_id);
        const idMap: Record<string, string> = {};

        for (const item of parentItems) {
          const { data: newItem, error: itemErr } = await supabase
            .from('repair_order_items')
            .insert({
              repair_order_id: newRo.id,
              item_type: item.item_type,
              description: item.description,
              quantity: item.quantity,
              labor_hours: item.labor_hours,
              unit_price: item.unit_price,
              total: item.total,
              taxable: item.taxable,
              status: 'pending',
              parent_item_id: null,
              part_id: item.part_id || null,
              part_cost_snapshot: item.part_cost_snapshot ?? null,
              customer_notes: (item as any).customer_notes || null,
            })
            .select('id')
            .single();
          if (itemErr) throw itemErr;
          idMap[item.id] = newItem.id;
        }

        const childItems = sourceItems.filter((i) => i.parent_item_id);
        for (const item of childItems) {
          const mappedParentId = item.parent_item_id ? (idMap[item.parent_item_id] || null) : null;
          await supabase.from('repair_order_items').insert({
            repair_order_id: newRo.id,
            item_type: item.item_type,
            description: item.description,
            quantity: item.quantity,
            labor_hours: item.labor_hours,
            unit_price: item.unit_price,
            total: item.total,
            taxable: item.taxable,
            status: 'pending',
            parent_item_id: mappedParentId,
            part_id: item.part_id || null,
            part_cost_snapshot: item.part_cost_snapshot ?? null,
            customer_notes: (item as any).customer_notes || null,
          });
        }

        const { data: copiedItems } = await supabase
          .from('repair_order_items')
          .select('*')
          .eq('repair_order_id', newRo.id)
          .order('created_at', { ascending: true });

        const nextItems = (copiedItems || []) as RepairOrderItem[];
        const totals = computeTotals(nextItems);
        await supabase.from('repair_orders').update({ ...totals, updated_at: now }).eq('id', newRo.id);

        const customer = customers.find((c) => c.id === newRo.customer_id);
        const vehicle = vehicles.find((v) => v.id === newRo.vehicle_id) || null;
        setOrders((prev) => [{ ...(newRo as RepairOrder), ...totals, customer, vehicle, items: nextItems }, ...prev]);
      } else {
        const customer = customers.find((c) => c.id === newRo.customer_id);
        const vehicle = vehicles.find((v) => v.id === newRo.vehicle_id) || null;
        setOrders((prev) => [{ ...(newRo as RepairOrder), customer, vehicle }, ...prev]);
      }

      showMessage('success', 'Repair order duplicated');
      setSelectedOrderId(newRo.id);
    } catch (error) {
      console.error('Error duplicating repair order:', error);
      showMessage('error', 'Failed to duplicate repair order');
    } finally {
      setDuplicating(false);
    }
  };

  const handleReviseOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('repair_orders')
        .update({
          status: 'draft',
          customer_signature: null,
          customer_signature_name: null,
          customer_signature_status: null,
          customer_signature_at: null,
          has_signature: false,
          customer_declined_at: null,
          customer_notes: null,
          customer_approved_at: null,
          approved_at: null,
          approved_by: null,
          customer_notified_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) throw error;

      await supabase
        .from('repair_order_items')
        .update({ status: 'pending' })
        .eq('repair_order_id', orderId);

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'draft',
                customer_signature: null,
                customer_signature_name: null,
                customer_signature_status: null,
                customer_signature_at: null,
                has_signature: false,
                customer_declined_at: null,
                customer_notes: null,
                customer_approved_at: null,
                approved_at: null,
                approved_by: null,
                customer_notified_at: null,
                items: (o.items || []).map((item) => ({ ...item, status: 'pending' })),
              } as RepairOrderWithDetails
            : o
        )
      );
      showMessage('success', 'Repair order reset to draft for revision');
    } catch (error) {
      console.error('Error revising repair order:', error);
      showMessage('error', 'Failed to revise repair order');
    }
  };

  const handleCreateOrder = async () => {
    if (!admin?.shop_id || !newOrder.customer_id) {
      showMessage('error', 'Select a customer before creating an order');
      return;
    }
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('repair_orders')
        .insert({
          shop_id: admin.shop_id,
          customer_id: newOrder.customer_id,
          vehicle_id: newOrder.vehicle_id || null,
          status: 'draft',
          ro_number: generateRoNumber(),
          internal_notes: newOrder.internal_notes || null,
          labor_total: 0,
          parts_total: 0,
          fees_total: 0,
          tax_total: 0,
          grand_total: 0,
          created_at: now,
          updated_at: now,
          customer_notified_at: null,
        })
        .select('*')
        .single();

      if (error) throw error;
        showMessage('success', 'Repair order created');
      setShowNewOrder(false);
      setNewOrder({ customer_id: '', vehicle_id: '', internal_notes: '' });
      setOrders((prev) => [{ ...(data as RepairOrder), customer: customers.find((c) => c.id === data.customer_id), vehicle: vehicles.find((v) => v.id === data.vehicle_id) || null }, ...prev]);
    } catch (error) {
      console.error('Error creating repair order:', error);
      showMessage('error', 'Failed to create repair order');
    }
  };

  const handleAddItem = async (orderId: string) => {
    const draft = itemDrafts[orderId] || emptyItem;
    if (!draft.description.trim()) {
      showMessage('error', 'Add a description before saving');
      return;
    }

      try {
        const isLabor = draft.item_type === 'labor';
        const quantityValue = isLabor ? 1 : Number(draft.quantity);
        if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
          showMessage('error', 'Quantity must be greater than 0');
          return;
        }
        if (isLabor && (draft.labor_hours === null || draft.labor_hours === undefined)) {
          showMessage('error', 'Enter labor hours for labor line items');
          return;
        }
        const unitPriceValue = roundToCents(Number(draft.unit_price));
        const total = roundToCents((isLabor ? Number(draft.labor_hours || 0) : quantityValue) * unitPriceValue);
        const { data, error } = await supabase
          .from('repair_order_items')
          .insert({
            repair_order_id: orderId,
            item_type: draft.item_type,
            description: draft.description.trim(),
            quantity: quantityValue,
            labor_hours: isLabor ? draft.labor_hours : null,
            unit_price: unitPriceValue,
            total,
            taxable: Boolean(draft.taxable),
            parent_item_id: draft.parent_item_id || null,
            status: 'pending',
            part_id: draft.part_id || null,
            part_cost_snapshot: draft.part_cost_snapshot ?? null,
            customer_notes: draft.customer_notes?.trim() || null,
          })
        .select('*')
        .single();

      if (error) throw error;

      const currentOrder = orders.find((order) => order.id === orderId);
      const nextItems = [...(currentOrder?.items || []), data as RepairOrderItem];
      const totals = computeTotals(nextItems);

      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          return { ...order, items: nextItems, ...totals };
        })
      );
      setItemDrafts((prev) => ({
        ...prev,
        [orderId]: { ...emptyItem, taxable: taxableTypes.includes('part'), unit_price: laborRate },
      }));

      if (draft.part_id && admin?.shop_id && !isLabor) {
        try {
          const reservation = await reservePartAction({
            shopId: admin.shop_id,
            orderId,
            partId: draft.part_id,
            locationId: (draft as any)._locationId || '',
            quantity: quantityValue,
            isSpecialOrder: Boolean((draft as any)._isSpecialOrder),
            repairOrderItemId: (data as RepairOrderItem).id,
          });
          setReservations((prev) => [...prev, reservation]);
        } catch (reserveErr) {
          console.warn('Auto-reserve failed (non-fatal):', reserveErr);
        }
      }

      // Persist totals to database
      try {
        const { error: updateError } = await supabase
          .from('repair_orders')
          .update({ ...totals, updated_at: new Date().toISOString() })
          .eq('id', orderId);
        if (updateError) console.error('Failed to persist totals:', updateError);
      } catch (err) {
        console.error('Failed to persist totals:', err);
      }

      showMessage('success', 'Item added');
    } catch (error) {
      console.error('Error adding item:', error);
      showMessage('error', 'Failed to add item');
    }
  };

  const handleQuickAddTemplate = async (orderId: string, template: QuickAddTemplate) => {
    try {
      const laborTotal = roundToCents(template.labor.hours * template.labor.unit_price);
      const { data: laborItem, error: laborError } = await supabase
        .from('repair_order_items')
        .insert({
          repair_order_id: orderId,
          item_type: 'labor',
          description: template.labor.description,
          quantity: 1,
          labor_hours: template.labor.hours,
          unit_price: template.labor.unit_price,
          total: laborTotal,
          taxable: taxableTypes.includes('labor'),
          status: 'pending',
        })
        .select('*')
        .single();
      if (laborError) throw laborError;

      const partRows = template.parts.map((part) => ({
        repair_order_id: orderId,
        item_type: 'part',
        description: part.description,
        quantity: part.quantity,
        labor_hours: null,
        unit_price: part.unit_price,
        total: roundToCents(part.quantity * part.unit_price),
        taxable: taxableTypes.includes('part'),
        parent_item_id: laborItem?.id || null,
        status: 'pending',
      }));

      if (partRows.length) {
        const { error: partError } = await supabase
          .from('repair_order_items')
          .insert(partRows);
        if (partError) throw partError;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('repair_order_items')
        .select('*')
        .eq('repair_order_id', orderId)
        .order('created_at', { ascending: true });
      if (itemsError) throw itemsError;
      const nextItems = (itemsData || []) as RepairOrderItem[];
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, items: nextItems } : order))
      );
      await updateOrderTotals(orderId, nextItems);
      showMessage('success', `${template.label} added`);
    } catch (error) {
      console.error('Failed to add quick template:', error);
      showMessage('error', 'Failed to add quick template');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getCustomerLabel = (customer?: Customer) => customer?.full_name || 'Unknown Customer';

  const getVehicleLabel = (vehicle?: Vehicle | null) => {
    if (!vehicle) return 'No vehicle';
    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading repair orders...</div>
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
        <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Repair Orders Not Enabled Yet</h3>
        <p className="text-slate-600">
          The Repair Orders tables are not available in the current database. Once your Supabase branch is ready,
          add the RO Lite schema and this area will activate automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {message && (
        <div
          className="p-4 rounded-lg"
          style={message.type === 'success' ? {
            backgroundColor: `${brandSettings.primary_color}10`,
            color: brandSettings.primary_color
          } : { backgroundColor: '#fef2f2', color: '#991b1b' }}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Repair Orders</h2>
          <p className="text-slate-600">Create and manage RO Lite estimates</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedOrderId || ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '__new__') {
                setSelectedOrderId('');
                setShowNewOrder(true);
                return;
              }
              if (value) {
                setShowNewOrder(false);
                handleSelectOrder(value);
              }
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">Open Repair Orders</option>
            {openOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.ro_number}
              </option>
            ))}
            {inspectionCompleteOrders.length > 0 && (
              <option disabled>— Inspection Complete —</option>
            )}
            {inspectionCompleteOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.ro_number}
              </option>
            ))}
            <option value="__new__">+ Create New RO</option>
          </select>
        </div>
      </div>

      {showNewOrder && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Create Repair Order</h3>
            <button onClick={() => setShowNewOrder(false)} className="text-slate-500 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Customer</label>
              <select
                value={newOrder.customer_id}
                onChange={(e) => setNewOrder((prev) => ({ ...prev, customer_id: e.target.value, vehicle_id: '' }))}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Vehicle</label>
              <select
                value={newOrder.vehicle_id}
                onChange={(e) => setNewOrder((prev) => ({ ...prev, vehicle_id: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                disabled={!newOrder.customer_id}
              >
                <option value="">No vehicle</option>
                {vehicles.filter((v) => v.customer_id === newOrder.customer_id).map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Internal Notes</label>
              <textarea
                value={newOrder.internal_notes}
                onChange={(e) => setNewOrder((prev) => ({ ...prev, internal_notes: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={3}
                placeholder="Internal shop notes (not visible to customer)"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateOrder}
              className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg"
              style={{ backgroundColor: brandSettings.primary_color }}
            >
              <Save className="w-4 h-4" />
              Create
            </button>
            <button
              onClick={() => setShowNewOrder(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Repair Orders</h3>
          <p className="text-slate-600">Create your first RO to start estimating work.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4 lg:col-span-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Open</div>
                {awaitingApprovalCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                    {awaitingApprovalCount} awaiting approval
                  </span>
                )}
              </div>
              {openOrders.length === 0 && (
                <p className="text-sm text-slate-500">No open repair orders.</p>
              )}
              {openOrders.map((order) => {
                const displayTotals = getDisplayTotals(order);
                return (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      order.id === selectedOrderId
                        ? 'border-slate-400 bg-slate-50'
                        : order.status === 'awaiting_approval'
                        ? 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{order.ro_number}</p>
                        <p className="text-sm text-slate-600">{getCustomerLabel(order.customer)}</p>
                        <p className="text-xs text-slate-500">{getVehicleLabel(order.vehicle)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${statusStyles[order.status].bg} ${statusStyles[order.status].text}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                      <DollarSign className="w-4 h-4" />
                      ${displayTotals.grand_total.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Inspection Complete</div>
              {inspectionCompleteOrders.length === 0 && (
                <p className="text-sm text-slate-500">No inspections completed yet.</p>
              )}
              {inspectionCompleteOrders.map((order) => {
                const displayTotals = getDisplayTotals(order);
                return (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      order.id === selectedOrderId ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{order.ro_number}</p>
                        <p className="text-sm text-slate-600">{getCustomerLabel(order.customer)}</p>
                        <p className="text-xs text-slate-500">{getVehicleLabel(order.vehicle)}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${statusStyles[order.status].bg} ${statusStyles[order.status].text}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                      <DollarSign className="w-4 h-4" />
                      ${displayTotals.grand_total.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Past (Closed)</div>
              {pastOrders.length === 0 && (
                <p className="text-sm text-slate-500">No closed repair orders.</p>
              )}
              {pastOrders.map((order) => {
                const displayTotals = getDisplayTotals(order);
                return (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      order.id === selectedOrderId ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{order.ro_number}</p>
                        <p className="text-sm text-slate-600">{getCustomerLabel(order.customer)}</p>
                        <p className="text-xs text-slate-500">{getVehicleLabel(order.vehicle)}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${statusStyles[order.status].bg} ${statusStyles[order.status].text}`}>
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                      <DollarSign className="w-4 h-4" />
                      ${displayTotals.grand_total.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
            {!selectedOrder ? (
              <div className="text-center py-12 text-slate-500">
                Select a repair order to view details.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{selectedOrder.ro_number}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {getCustomerLabel(selectedOrder.customer)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Car className="w-4 h-4" />
                        {getVehicleLabel(selectedOrder.vehicle)}
                      </span>
                    </div>
                  </div>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => requestStatusChange(selectedOrder.id, e.target.value as RepairOrderStatus)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{statusLabels[status]}</option>
                    ))}
                  </select>
                </div>

                {selectedOrder.internal_notes && (
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                    {selectedOrder.internal_notes}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-900">Line Items</h4>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedOrder) return;
                        setDviModalOpen(true);
                        loadDviRecommendations(selectedOrder);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                        dviAvailable ? 'border-slate-300 text-slate-700' : 'border-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                      disabled={!dviAvailable}
                      title={dviAvailable ? 'Import items from the latest DVI' : 'No DVI recommendations available'}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      DVI Recommendations
                    </button>
                  </div>
                  {(selectedOrder.items || []).length === 0 ? (
                    <div className="text-sm text-slate-600">No line items yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {nestedLineItems.map(({ item, children }) => {
                        const isEditing = editingItemId === item.id;
                        const draft = editDrafts[item.id] || item;
                        return (
                          <div key={item.id} className="space-y-2">
                            <div className="flex items-start justify-between p-3 border border-slate-200 rounded-lg">
                              <div className="flex-1 space-y-2">
                                {isEditing ? (
                                  <>
                                    <input
                                      value={String(draft.description || '')}
                                      onChange={(e) => updateEditDraft(item.id, { description: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    />
                                    <input
                                      value={String((draft as any).customer_notes || '')}
                                      onChange={(e) => updateEditDraft(item.id, { customer_notes: e.target.value } as any)}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                      placeholder="Customer-visible note (optional)"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      {draft.item_type === 'labor' ? (
                                        <>
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.1"
                                            value={draft.labor_hours ?? ''}
                                            onChange={(e) => updateEditDraft(item.id, { labor_hours: e.target.value === '' ? null : Number(e.target.value) })}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            placeholder="Labor hrs"
                                          />
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={draft.unit_price ?? 0}
                                            onChange={(e) => updateEditDraft(item.id, { unit_price: Number(e.target.value) })}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            placeholder="Labor rate"
                                          />
                                        </>
                                      ) : (
                                        <>
                                          <input
                                            type="number"
                                            min={0.01}
                                            step="0.01"
                                            value={draft.quantity ?? 1}
                                            onChange={(e) => updateEditDraft(item.id, { quantity: Number(e.target.value) })}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            placeholder="Qty"
                                          />
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={draft.unit_price ?? 0}
                                            onChange={(e) => updateEditDraft(item.id, { unit_price: Number(e.target.value) })}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            placeholder="Unit price"
                                          />
                                          <select
                                            value={draft.parent_item_id || ''}
                                            onChange={(e) => updateEditDraft(item.id, { parent_item_id: e.target.value || null })}
                                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                          >
                                            <option value="">Attach to labor line (optional)</option>
                                            {laborLineItems.map((labor) => (
                                              <option key={labor.id} value={labor.id}>{labor.description}</option>
                                            ))}
                                          </select>
                                        </>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <label className="flex items-center gap-2 text-xs text-slate-600">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(draft.taxable)}
                                          onChange={(e) => updateEditDraft(item.id, { taxable: e.target.checked })}
                                        />
                                        Taxable
                                      </label>
                                      <select
                                        value={draft.status || 'pending'}
                                        onChange={(e) => updateEditDraft(item.id, { status: e.target.value as RepairOrderItem['status'] })}
                                        className="border border-slate-300 rounded-lg px-3 py-1 text-xs"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="declined">Declined</option>
                                      </select>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      {item.item_type === 'discount' && <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                      <p className={`font-medium ${item.item_type === 'discount' ? 'text-emerald-700' : 'text-slate-900'}`}>{item.description}</p>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                      {item.item_type === 'discount' ? 'DISCOUNT' : item.item_type.toUpperCase()} - {item.item_type === 'labor' ? `${item.labor_hours ?? 0} hrs` : `Qty ${item.quantity}`} - ${item.unit_price.toFixed(2)}
                                      {item.item_type === 'part' && item.part_cost_snapshot != null && (
                                        <span className="ml-1 text-slate-400">(cost ${Number(item.part_cost_snapshot).toFixed(2)})</span>
                                      )}
                                    </p>
                                    {(item as any).customer_notes && (
                                      <p className="text-xs text-blue-600 mt-0.5">{(item as any).customer_notes}</p>
                                    )}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : item.status === 'declined' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {item.status || 'pending'}
                                      </span>
                                      {item.item_type === 'part' && (
                                        <StockStatusBadge
                                          partId={item.part_id}
                                          repairOrderId={selectedOrder.id}
                                          quantity={item.quantity}
                                          reservations={reservations}
                                        />
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                        <div className={`font-semibold ${item.item_type === 'discount' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                          {item.item_type === 'discount' ? '-' : ''}${computeLineTotal(item).toFixed(2)}
                                        </div>
                                {isEditing ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveEdit(selectedOrder.id, item.id)}
                                      className="px-3 py-1 text-xs rounded-lg border border-slate-300"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="px-3 py-1 text-xs rounded-lg border border-slate-200 text-slate-500"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => startEditItem(item)}
                                      className="px-3 py-1 text-xs rounded-lg border border-slate-300"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLineItem(selectedOrder.id, item.id)}
                                      className="px-3 py-1 text-xs rounded-lg border border-rose-200 text-rose-600"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {children.length > 0 && (
                              <div className="space-y-2 pl-4 border-l border-slate-200">
                                {children.map((child) => {
                                  const isChildEditing = editingItemId === child.id;
                                  const childDraft = editDrafts[child.id] || child;
                                  return (
                                    <div key={child.id} className="flex items-start justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                                      <div className="flex-1 space-y-2">
                                        {isChildEditing ? (
                                          <>
                                            <input
                                              value={String(childDraft.description || '')}
                                              onChange={(e) => updateEditDraft(child.id, { description: e.target.value })}
                                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                            />
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                              <input
                                                type="number"
                                                min={0.01}
                                                step="0.01"
                                                value={childDraft.quantity ?? 1}
                                                onChange={(e) => updateEditDraft(child.id, { quantity: Number(e.target.value) })}
                                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                                placeholder="Qty"
                                              />
                                              <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={childDraft.unit_price ?? 0}
                                                onChange={(e) => updateEditDraft(child.id, { unit_price: Number(e.target.value) })}
                                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                                placeholder="Unit price"
                                              />
                                              <select
                                                value={childDraft.parent_item_id || ''}
                                                onChange={(e) => updateEditDraft(child.id, { parent_item_id: e.target.value || null })}
                                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                              >
                                                <option value="">Attach to labor line (optional)</option>
                                                {laborLineItems.map((labor) => (
                                                  <option key={labor.id} value={labor.id}>{labor.description}</option>
                                                ))}
                                              </select>
                                              <select
                                                value={childDraft.status || 'pending'}
                                                onChange={(e) => updateEditDraft(child.id, { status: e.target.value as RepairOrderItem['status'] })}
                                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                              >
                                                <option value="pending">Pending</option>
                                                <option value="approved">Approved</option>
                                                <option value="declined">Declined</option>
                                              </select>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <p className="font-medium text-slate-900">{child.description}</p>
                                            <p className="text-xs text-slate-500">
                                              {child.item_type.toUpperCase()} - Qty {child.quantity} - ${child.unit_price.toFixed(2)}
                                              {child.item_type === 'part' && child.part_cost_snapshot != null && (
                                                <span className="ml-1 text-slate-400">(cost ${Number(child.part_cost_snapshot).toFixed(2)})</span>
                                              )}
                                            </p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${child.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : child.status === 'declined' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {child.status || 'pending'}
                                              </span>
                                              {child.item_type === 'part' && (
                                                <StockStatusBadge
                                                  partId={child.part_id}
                                                  repairOrderId={selectedOrder.id}
                                                  quantity={child.quantity}
                                                  reservations={reservations}
                                                />
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-end gap-2">
                                        <div className="font-semibold text-slate-900">${computeLineTotal(child).toFixed(2)}</div>
                                        {isChildEditing ? (
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => saveEdit(selectedOrder.id, child.id)}
                                              className="px-3 py-1 text-xs rounded-lg border border-slate-300"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={cancelEdit}
                                              className="px-3 py-1 text-xs rounded-lg border border-slate-200 text-slate-500"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => startEditItem(child)}
                                              className="px-3 py-1 text-xs rounded-lg border border-slate-300"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => handleDeleteLineItem(selectedOrder.id, child.id)}
                                              className="px-3 py-1 text-xs rounded-lg border border-rose-200 text-rose-600"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Boxes className="w-4 h-4" />
                    <h4 className="font-semibold text-slate-900">Reserve Parts</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select
                      value={reservationDraft.part_id}
                      onChange={(e) => setReservationDraft({ ...reservationDraft, part_id: e.target.value })}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select part</option>
                      {parts.map((part) => (
                        <option key={part.id} value={part.id}>{part.name}</option>
                      ))}
                    </select>
                    <select
                      value={reservationDraft.location_id}
                      onChange={(e) => setReservationDraft({ ...reservationDraft, location_id: e.target.value })}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      disabled={reservationDraft.is_special_order}
                    >
                      <option value="">Select location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={reservationDraft.quantity}
                      onChange={(e) => setReservationDraft({ ...reservationDraft, quantity: Number(e.target.value) })}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Qty"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={reservationDraft.is_special_order}
                        onChange={(e) => setReservationDraft({ ...reservationDraft, is_special_order: e.target.checked })}
                      />
                      Special order (not in stock)
                    </label>
                    <button
                      onClick={() => reservePart(selectedOrder.id)}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-white rounded-lg text-sm"
                      style={{ backgroundColor: brandSettings.primary_color }}
                    >
                      Reserve
                    </button>
                  </div>
                  {reservations.length > 0 && (
                    <div className="space-y-2">
                      {reservations.map((res) => (
                        <div key={res.id} className="border border-slate-200 rounded-lg p-3 text-sm flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900">{parts.find((p) => p.id === res.part_id)?.name || 'Part'}</p>
                            <p className="text-xs text-slate-500">
                              {res.is_special_order ? 'Special order' : (locations.find((l) => l.id === res.location_id)?.name || 'Location')}
                              {' · '}Qty {res.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              res.status === 'consumed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : res.is_special_order
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {res.status === 'consumed' ? 'Installed' : res.job_status || res.status}
                            </span>
                            {res.status !== 'consumed' && (
                              <button
                                onClick={() => handleUnreservePart(res)}
                                className="px-2 py-1 text-xs rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Unreserve this part"
                              >
                                Unreserve
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Messages
                    </h4>
                    <button
                      onClick={() => setShowChat(!showChat)}
                      className="text-sm text-slate-600"
                    >
                      {showChat ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {showChat && (
                    <div className="space-y-4">
                      <ChatThread
                        shopId={selectedOrder.shop_id}
                        customerId={selectedOrder.customer_id}
                        repairOrderId={selectedOrder.id}
                        threadType="ro"
                        title="Customer Thread"
                        subtitle="Visible to the customer"
                      />
                      <ChatThread
                        shopId={selectedOrder.shop_id}
                        customerId={selectedOrder.customer_id}
                        repairOrderId={selectedOrder.id}
                        threadType="internal"
                        title="Internal Notes Thread"
                        subtitle="Staff only"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-slate-900">Add Line Item</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick add bundles</span>
                    {quickAddTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => selectedOrder && handleQuickAddTemplate(selectedOrder.id, template)}
                        className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs text-slate-700 hover:border-slate-300 hover:text-slate-900"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <select
                        value={(itemDrafts[selectedOrder.id] || emptyItem).item_type}
                        onChange={(e) => setItemDrafts((prev) => ({
                          ...prev,
                          [selectedOrder.id]: {
                            ...(prev[selectedOrder.id] || emptyItem),
                            item_type: e.target.value as RepairOrderItem['item_type'],
                            part_id: null,
                            part_cost_snapshot: null,
                            description: e.target.value !== (prev[selectedOrder.id] || emptyItem).item_type ? '' : (prev[selectedOrder.id] || emptyItem).description,
                            unit_price: e.target.value === 'labor'
                              ? laborRate
                              : e.target.value === 'part'
                              ? (() => {
                                const costValue = Number((prev[selectedOrder.id] || emptyItem).cost || 0);
                                const markup = getMarkupPercent(costValue);
                                return roundToCents(costValue + (costValue * markup / 100));
                              })()
                              : (prev[selectedOrder.id] || emptyItem).unit_price,
                            taxable: taxableTypes.includes(e.target.value),
                            parent_item_id: e.target.value === 'labor'
                              ? null
                              : (prev[selectedOrder.id] || emptyItem).parent_item_id,
                          },
                        }))}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="labor">Labor</option>
                        <option value="part">Part</option>
                        <option value="fee">Fee</option>
                        <option value="discount">Discount</option>
                    </select>
                      {(itemDrafts[selectedOrder.id] || emptyItem).item_type === 'part' ? (
                        <div className="md:col-span-2">
                          <PartsPicker
                            shopId={admin?.shop_id || ''}
                            markupRules={markupRules}
                            locations={locations}
                            selectedPartId={(itemDrafts[selectedOrder.id] || emptyItem).part_id}
                            selectedPartName={(itemDrafts[selectedOrder.id] || emptyItem).description}
                            quantity={(itemDrafts[selectedOrder.id] || emptyItem).quantity}
                            onSelect={(info: SelectedPartInfo) => {
                              setItemDrafts((prev) => ({
                                ...prev,
                                [selectedOrder.id]: {
                                  ...(prev[selectedOrder.id] || emptyItem),
                                  part_id: info.part.id,
                                  part_cost_snapshot: info.unitCost,
                                  description: info.part.name,
                                  cost: info.unitCost,
                                  unit_price: info.unitPrice,
                                  taxable: info.part.taxable,
                                  _locationId: info.location?.location_id || '',
                                  _isSpecialOrder: info.isSpecialOrder,
                                } as typeof emptyItem & { _locationId: string; _isSpecialOrder: boolean },
                              }));
                            }}
                            onClear={() => {
                              setItemDrafts((prev) => ({
                                ...prev,
                                [selectedOrder.id]: {
                                  ...(prev[selectedOrder.id] || emptyItem),
                                  part_id: null,
                                  part_cost_snapshot: null,
                                  description: '',
                                  cost: 0,
                                  unit_price: 0,
                                },
                              }));
                            }}
                          />
                        </div>
                      ) : (
                        <input
                          value={(itemDrafts[selectedOrder.id] || emptyItem).description}
                          onChange={(e) => setItemDrafts((prev) => ({
                            ...prev,
                            [selectedOrder.id]: { ...(prev[selectedOrder.id] || emptyItem), description: e.target.value },
                          }))}
                          placeholder="Description"
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm md:col-span-2"
                        />
                      )}
                      {(itemDrafts[selectedOrder.id] || emptyItem).item_type !== 'labor' && (
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={(itemDrafts[selectedOrder.id] || emptyItem).quantity}
                          onChange={(e) => setItemDrafts((prev) => ({
                            ...prev,
                            [selectedOrder.id]: {
                              ...(prev[selectedOrder.id] || emptyItem),
                              quantity: Number.parseFloat(e.target.value || '0'),
                            },
                          }))}
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="Qty"
                        />
                      )}
                      {(itemDrafts[selectedOrder.id] || emptyItem).item_type === 'labor' && (
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={(itemDrafts[selectedOrder.id] || emptyItem).labor_hours ?? ''}
                          onChange={(e) => setItemDrafts((prev) => ({
                            ...prev,
                            [selectedOrder.id]: {
                              ...(prev[selectedOrder.id] || emptyItem),
                              labor_hours: e.target.value === '' ? null : Number.parseFloat(e.target.value),
                            },
                          }))}
                          placeholder="Labor hrs"
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                      )}
                      {(itemDrafts[selectedOrder.id] || emptyItem).item_type === 'part' && !(itemDrafts[selectedOrder.id] || emptyItem).part_id && (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={(itemDrafts[selectedOrder.id] || emptyItem).cost}
                          onChange={(e) => setItemDrafts((prev) => {
                            const costValue = Number.parseFloat(e.target.value || '0');
                            const markup = getMarkupPercent(costValue);
                            const unitPriceValue = roundToCents(costValue + (costValue * markup / 100));
                            return {
                              ...prev,
                              [selectedOrder.id]: {
                                ...(prev[selectedOrder.id] || emptyItem),
                                cost: costValue,
                                unit_price: unitPriceValue,
                              },
                            };
                          })}
                          placeholder="Cost"
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                      )}
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={(itemDrafts[selectedOrder.id] || emptyItem).unit_price}
                        onChange={(e) => setItemDrafts((prev) => ({
                          ...prev,
                          [selectedOrder.id]: { ...(prev[selectedOrder.id] || emptyItem), unit_price: Number(e.target.value) },
                        }))}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                      {(itemDrafts[selectedOrder.id] || emptyItem).item_type !== 'labor' && (
                        <select
                          value={(itemDrafts[selectedOrder.id] || emptyItem).parent_item_id || ''}
                          onChange={(e) => setItemDrafts((prev) => ({
                            ...prev,
                            [selectedOrder.id]: {
                              ...(prev[selectedOrder.id] || emptyItem),
                              parent_item_id: e.target.value || null,
                            },
                          }))}
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Attach to labor line (optional)</option>
                          {laborLineItems.map((labor) => (
                            <option key={labor.id} value={labor.id}>{labor.description}</option>
                          ))}
                        </select>
                      )}
                  </div>
                  <div className="space-y-2">
                    <input
                      value={(itemDrafts[selectedOrder.id] || emptyItem).customer_notes || ''}
                      onChange={(e) => setItemDrafts((prev) => ({
                        ...prev,
                        [selectedOrder.id]: { ...(prev[selectedOrder.id] || emptyItem), customer_notes: e.target.value },
                      }))}
                      placeholder="Customer-visible note (optional)"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={(itemDrafts[selectedOrder.id] || emptyItem).taxable}
                          onChange={(e) => setItemDrafts((prev) => ({
                            ...prev,
                            [selectedOrder.id]: { ...(prev[selectedOrder.id] || emptyItem), taxable: e.target.checked },
                          }))}
                        />
                        Taxable
                      </label>
                      <button
                        onClick={() => handleAddItem(selectedOrder.id)}
                        className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                        style={{ backgroundColor: brandSettings.primary_color }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Item
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    <AlertCircle className="w-4 h-4" />
                    Status: {statusLabels[selectedOrder.status]}
                  </div>
                  <div className="text-right space-y-1 text-sm">
                    <div>Labor: ${selectedOrder.labor_total.toFixed(2)}</div>
                    <div>Parts: ${selectedOrder.parts_total.toFixed(2)}</div>
                    <div>Fees: ${selectedOrder.fees_total.toFixed(2)}</div>
                    <div>Supplies (included): ${selectedOrderTotals.supplies_amount.toFixed(2)}</div>
                    <div>Tax: ${selectedOrder.tax_total.toFixed(2)}</div>
                    <div className="font-semibold text-slate-900">Total: ${selectedOrderTotals.grand_total.toFixed(2)}</div>
                  </div>
                </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.status === 'declined' ? (
                      <button
                        onClick={() => setConfirmModal({
                          title: 'Revise & Re-send Estimate',
                          body: 'This will reset the order back to draft so you can edit and re-send it to the customer. All item statuses will be cleared.',
                          confirmLabel: 'Revise',
                          confirmStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
                          onConfirm: () => { setConfirmModal(null); handleReviseOrder(selectedOrder.id); },
                        })}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Revise & Re-send
                      </button>
                    ) : selectedOrder.status !== 'closed' && selectedOrder.status !== 'awaiting_approval' && (
                      <button
                        onClick={() => requestStatusChange(selectedOrder.id, 'awaiting_approval')}
                        className="flex items-center gap-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Send for Approval
                      </button>
                    )}
                    {selectedOrder.status === 'awaiting_approval' && (
                      <button
                        onClick={() => handleApproveOrder(selectedOrder.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark Approved
                      </button>
                    )}
                    {selectedOrder.status !== 'closed' && selectedOrder.status !== 'draft' && (
                      <button
                        onClick={() => requestStatusChange(selectedOrder.id, 'closed')}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Close RO
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicateOrder(selectedOrder.id)}
                      disabled={duplicating}
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm disabled:opacity-50"
                    >
                      <Copy className="w-4 h-4" />
                      {duplicating ? 'Duplicating...' : 'Duplicate'}
                    </button>
                    <button
                      onClick={() => handleDeleteOrder(selectedOrder.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                    >
                      <X className="w-4 h-4" />
                      Delete RO
                    </button>
                  </div>
              </div>
            )}
          </div>
        </div>
      )}

      {dviModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">DVI Recommendations</h3>
                <p className="text-xs text-slate-500">Select recommended work to import into this repair order.</p>
                {dviReportStatus === 'draft' && (
                  <span className="inline-flex mt-2 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs">
                    Draft DVI
                  </span>
                )}
              </div>
              <button onClick={() => setDviModalOpen(false)} className="text-slate-500 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {dviLoading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((idx) => (
                    <div key={idx} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              )}

              {!dviLoading && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={dviSearch}
                      onChange={(event) => setDviSearch(event.target.value)}
                      placeholder="Search recommendations"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <button
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
                      onClick={() => {
                        const next: Record<string, boolean> = { ...dviSelected };
                        filteredPriority.forEach((item) => {
                          if (!item.alreadyAdded) next[item.id] = true;
                        });
                        setDviSelected(next);
                      }}
                    >
                      Select all priority
                    </button>
                    <button
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
                      onClick={() => {
                        const next: Record<string, boolean> = { ...dviSelected };
                        filteredFuture.forEach((item) => {
                          if (!item.alreadyAdded) next[item.id] = true;
                        });
                        setDviSelected(next);
                      }}
                    >
                      Select all future
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        Priority Work
                      </div>
                      <p className="text-xs text-slate-500 mb-2">Red / Needs Immediate Attention</p>
                      {filteredPriority.length === 0 && (
                        <p className="text-xs text-slate-500">No priority recommendations.</p>
                      )}
                      <div className="space-y-2">
                        {filteredPriority.map((item) => (
                          <label
                            key={item.id}
                            className={`flex items-start gap-3 p-3 border rounded-xl ${item.alreadyAdded ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-200'}`}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(dviSelected[item.id])}
                              disabled={item.alreadyAdded}
                              onChange={(event) => setDviSelected((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium text-slate-900">{item.title}</div>
                                <span className="text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700">Red</span>
                              </div>
                              {item.notes && <div className="text-xs text-slate-500">{item.notes}</div>}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                {item.mediaCounts.photo > 0 && (
                                  <span className="flex items-center gap-1"><Camera className="w-3 h-3" />{item.mediaCounts.photo}</span>
                                )}
                                {item.mediaCounts.video > 0 && (
                                  <span className="flex items-center gap-1"><Video className="w-3 h-3" />{item.mediaCounts.video}</span>
                                )}
                                {item.mediaCounts.audio > 0 && (
                                  <span className="flex items-center gap-1"><Mic className="w-3 h-3" />{item.mediaCounts.audio}</span>
                                )}
                                {item.alreadyAdded && <span className="text-emerald-600">Already added</span>}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ClipboardCheck className="w-4 h-4 text-amber-500" />
                        Future Work
                      </div>
                      <p className="text-xs text-slate-500 mb-2">Yellow / Monitor / Recommended Soon</p>
                      {filteredFuture.length === 0 && (
                        <p className="text-xs text-slate-500">No future recommendations.</p>
                      )}
                      <div className="space-y-2">
                        {filteredFuture.map((item) => (
                          <label
                            key={item.id}
                            className={`flex items-start gap-3 p-3 border rounded-xl ${item.alreadyAdded ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-200'}`}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(dviSelected[item.id])}
                              disabled={item.alreadyAdded}
                              onChange={(event) => setDviSelected((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium text-slate-900">{item.title}</div>
                                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Yellow</span>
                              </div>
                              {item.notes && <div className="text-xs text-slate-500">{item.notes}</div>}
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                {item.mediaCounts.photo > 0 && (
                                  <span className="flex items-center gap-1"><Camera className="w-3 h-3" />{item.mediaCounts.photo}</span>
                                )}
                                {item.mediaCounts.video > 0 && (
                                  <span className="flex items-center gap-1"><Video className="w-3 h-3" />{item.mediaCounts.video}</span>
                                )}
                                {item.mediaCounts.audio > 0 && (
                                  <span className="flex items-center gap-1"><Mic className="w-3 h-3" />{item.mediaCounts.audio}</span>
                                )}
                                {item.alreadyAdded && <span className="text-emerald-600">Already added</span>}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-4 flex items-center justify-between bg-white sticky bottom-0">
              <button onClick={() => setDviModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={() => handleAddDviItems(selectedOrder)}
                className="px-4 py-2 text-white rounded-lg text-sm"
                style={{ backgroundColor: brandSettings.primary_color }}
                disabled={selectedCount === 0}
              >
                Add Selected ({selectedCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{confirmModal.title}</h3>
            <p className="text-sm text-slate-600">{confirmModal.body}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${confirmModal.confirmStyle || 'bg-slate-900 text-white'}`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
