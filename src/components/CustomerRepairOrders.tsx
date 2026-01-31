import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, ClipboardList, ClipboardCheck, MessageSquare } from 'lucide-react';
import { ChatThread } from './ChatThread';
import type { DviItemMedia, DviReport, DviReportItem, RepairOrder, RepairOrderItem } from '../types/database';

interface RepairOrderWithItems extends RepairOrder {
  items: RepairOrderItem[];
}

const statusLabels: Record<RepairOrder['status'], string> = {
  draft: 'Draft',
  awaiting_approval: 'Awaiting Approval',
  approved: 'Approved',
  declined: 'Declined',
  inspection_complete: 'Inspection Complete',
  closed: 'Closed',
};

export function CustomerRepairOrders() {
  const { customer } = useAuth();
  const { brandSettings } = useBrand();
  const [orders, setOrders] = useState<RepairOrderWithItems[]>([]);
  const [dviReports, setDviReports] = useState<Record<string, DviReport[]>>({});
  const [dviItems, setDviItems] = useState<Record<string, DviReportItem[]>>({});
  const [dviMedia, setDviMedia] = useState<Record<string, DviItemMedia[]>>({});
  const [dviMediaUrls, setDviMediaUrls] = useState<Record<string, string>>({});
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [expandedDviReports, setExpandedDviReports] = useState<Record<string, boolean>>({});
  const [expandedChat, setExpandedChat] = useState<Record<string, boolean>>({});
  const [lightboxImage, setLightboxImage] = useState<{ url: string; label: string } | null>(null);
  const [taxRate, setTaxRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const prevStatusRef = useRef<Record<string, RepairOrder['status']>>({});
  const mediaUrlRef = useRef<Record<string, string>>({});
  const itemChannelsRef = useRef<Record<string, ReturnType<typeof supabase.channel>>>({});
  const reportChannelsRef = useRef<Record<string, ReturnType<typeof supabase.channel>>>({});

  useEffect(() => {
    loadOrders();
    if (!customer?.id) return;
    const channel = supabase
      .channel(`customer-repair-orders-${customer.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'repair_orders',
        filter: `customer_id=eq.${customer.id}`,
      }, () => {
        loadOrders();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dvi_reports',
        filter: `customer_id=eq.${customer.id}`,
      }, () => {
        loadOrders();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const orderIds = useMemo(() => orders.map((order) => order.id), [orders]);
  const reportIds = useMemo(
    () => Object.values(dviReports).flat().map((report) => report.id),
    [dviReports]
  );

  useEffect(() => {
    orderIds.forEach((orderId) => {
      if (itemChannelsRef.current[orderId]) return;
      const channel = supabase
        .channel(`customer-ro-items-${orderId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'repair_order_items',
          filter: `repair_order_id=eq.${orderId}`,
        }, () => {
          loadOrders();
        })
        .subscribe();
      itemChannelsRef.current[orderId] = channel;
    });

    Object.keys(itemChannelsRef.current).forEach((orderId) => {
      if (!orderIds.includes(orderId)) {
        supabase.removeChannel(itemChannelsRef.current[orderId]);
        delete itemChannelsRef.current[orderId];
      }
    });
  }, [orderIds]);

  useEffect(() => {
    reportIds.forEach((reportId) => {
      if (reportChannelsRef.current[reportId]) return;
      const channel = supabase
        .channel(`customer-dvi-items-${reportId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'dvi_report_items',
          filter: `report_id=eq.${reportId}`,
        }, () => {
          loadOrders();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'dvi_item_media',
        }, () => {
          loadOrders();
        })
        .subscribe();
      reportChannelsRef.current[reportId] = channel;
    });

    Object.keys(reportChannelsRef.current).forEach((reportId) => {
      if (!reportIds.includes(reportId)) {
        supabase.removeChannel(reportChannelsRef.current[reportId]);
        delete reportChannelsRef.current[reportId];
      }
    });
  }, [reportIds]);

  useEffect(() => {
    return () => {
      Object.values(itemChannelsRef.current).forEach((channel) => {
        supabase.removeChannel(channel);
      });
      Object.values(reportChannelsRef.current).forEach((channel) => {
        supabase.removeChannel(channel);
      });
      itemChannelsRef.current = {};
      reportChannelsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!customer?.shop_id) return;
    loadTaxSettings(customer.shop_id);
  }, [customer?.shop_id]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const loadOrders = async () => {
    if (!customer) return;
    try {
      const { data: ordersData, error } = await supabase
        .from('repair_orders')
        .select('*')
        .eq('customer_id', customer.id)
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

      const orderList = (ordersData || []) as RepairOrder[];
      if (orderList.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const orderIds = orderList.map((o) => o.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('repair_order_items')
        .select('*')
        .in('repair_order_id', orderIds)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      const items = (itemsData || []) as RepairOrderItem[];
      const ordersWithItems = orderList.map((order) => ({
        ...order,
        items: items.filter((item) => item.repair_order_id === order.id),
      }));

      const { data: reportRows, error: reportError } = await supabase
        .from('dvi_reports')
        .select('*')
        .in('repair_order_id', orderIds)
        .eq('status', 'published');
      if (reportError) throw reportError;
      const reportsList = (reportRows || []) as DviReport[];
      const reportIds = reportsList.map((report) => report.id);

      const { data: reportItemRows, error: reportItemError } = await supabase
        .from('dvi_report_items')
        .select('*')
        .in('report_id', reportIds.length > 0 ? reportIds : ['00000000-0000-0000-0000-000000000000']);
      if (reportItemError) throw reportItemError;

      const reportItemList = (reportItemRows || []) as DviReportItem[];
      const reportItemIds = reportItemList.map((item) => item.id);
      const { data: mediaRows, error: mediaError } = await supabase
        .from('dvi_item_media')
        .select('*')
        .in('report_item_id', reportItemIds.length > 0 ? reportItemIds : ['00000000-0000-0000-0000-000000000000']);
      if (mediaError) throw mediaError;

      const reportMap: Record<string, DviReport[]> = {};
      reportsList.forEach((report) => {
        if (!reportMap[report.repair_order_id]) reportMap[report.repair_order_id] = [];
        reportMap[report.repair_order_id].push(report);
      });
      const itemMap: Record<string, DviReportItem[]> = {};
      reportItemList.forEach((item) => {
        if (!itemMap[item.report_id]) itemMap[item.report_id] = [];
        itemMap[item.report_id].push(item);
      });
      const mediaMap: Record<string, DviItemMedia[]> = {};
      (mediaRows || []).forEach((media) => {
        if (!mediaMap[media.report_item_id]) mediaMap[media.report_item_id] = [];
        mediaMap[media.report_item_id].push(media as DviItemMedia);
      });
      const mediaUrlMap: Record<string, string> = { ...mediaUrlRef.current };
      const missingMedia = (mediaRows || []).filter((media) => !mediaUrlMap[media.id]);
      await Promise.all(
        missingMedia.map(async (media) => {
          const { data: signed } = await supabase.storage
            .from('dvi-attachments')
            .createSignedUrl(media.storage_path, 3600);
          if (signed?.signedUrl) {
            mediaUrlMap[media.id] = signed.signedUrl;
          }
        })
      );

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const prevIds = prevOrderIdsRef.current;
        ordersWithItems.forEach((order) => {
          const prevStatus = prevStatusRef.current[order.id];
          if (!prevIds.has(order.id)) {
            new Notification('New Repair Order', {
              body: `${order.ro_number} is ready for review`,
              icon: '/favicon.ico',
            });
          } else if (prevStatus && prevStatus !== order.status) {
            new Notification('Repair Order Update', {
              body: `${order.ro_number} ${order.status.replace('_', ' ')}`,
              icon: '/favicon.ico',
            });
          }
        });
      }

      prevOrderIdsRef.current = new Set(ordersWithItems.map((order) => order.id));
      prevStatusRef.current = ordersWithItems.reduce((acc, order) => {
        acc[order.id] = order.status;
        return acc;
      }, {} as Record<string, RepairOrder['status']>);

      setOrders(ordersWithItems);
      setDviReports(reportMap);
      setDviItems(itemMap);
      setDviMedia(mediaMap);
      mediaUrlRef.current = mediaUrlMap;
      setDviMediaUrls(mediaUrlMap);
    } catch (error) {
      console.error('Error loading repair orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAll = async (orderId: string) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        const laborParentIds = (order.items || [])
          .filter((item) => item.item_type === 'labor' && !item.parent_item_id)
          .map((item) => item.id);
        const { error: itemError } = await supabase
          .from('repair_order_items')
          .update({ status: 'approved' })
          .eq('repair_order_id', orderId)
          .neq('status', 'declined');
        if (itemError) throw itemError;
        if (laborParentIds.length > 0) {
          const { error: childError } = await supabase
            .from('repair_order_items')
            .update({ status: 'approved' })
            .in('parent_item_id', laborParentIds)
            .neq('status', 'declined');
          if (childError) throw childError;
        }
        const nextItems = (order.items || []).map<RepairOrderItem>((item) => {
          if (item.status === 'declined') return item;
          if (item.item_type === 'labor' || item.item_type === 'part' || item.item_type === 'fee') {
            return { ...item, status: 'approved' };
          }
          if (item.parent_item_id && laborParentIds.includes(item.parent_item_id)) {
            return { ...item, status: 'approved' };
          }
          return item;
        });
        const totals = computeTotals(nextItems);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, items: nextItems, ...totals } : o))
        );
      }
      showMessage('success', 'Line items approved');
    } catch (error) {
      console.error('Error approving line items:', error);
      showMessage('error', 'Failed to approve line items');
    }
  };

  const handleSendToShop = async (orderId: string) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      const pending = (order.items || []).some((item) => !item.status || item.status === 'pending');
      if (pending) {
        showMessage('error', 'Please approve or decline all items before sending to the shop.');
        return;
      }

      const totals = computeTotals(order.items || []);
      const { error } = await supabase
        .from('repair_orders')
        .update({
          status: 'approved',
          ...totals,
          approved_at: new Date().toISOString(),
          customer_approved_at: new Date().toISOString(),
          customer_response_by: customer?.id || null,
          admin_notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) throw error;

      if (customer?.shop_id && order.ro_number) {
        await supabase.functions.invoke('send-push', {
          body: {
            target: 'admin',
            shop_id: customer.shop_id,
            title: 'Repair Order Approved',
            message: `${order.ro_number} was approved by the customer`,
            url: '/',
          },
        });
        await supabase.from('notifications').insert({
          shop_id: customer.shop_id,
          recipient_role: 'admin',
          recipient_id: null,
          title: 'Repair Order Approved',
          body: `${order.ro_number} was approved by the customer`,
          entity_type: 'repair_order',
          entity_id: orderId,
          action_url: '/?tab=my_shop&sub=repair_orders',
        });
      }
      showMessage('success', 'Sent to the shop');
      loadOrders();
    } catch (error) {
      console.error('Error sending to shop:', error);
      showMessage('error', 'Failed to send to shop');
    }
  };

  const handleDecline = async (orderId: string) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      const reason = prompt('Add a note for the shop (optional):');
      const { error } = await supabase
        .from('repair_orders')
        .update({
          status: 'declined',
          customer_notes: reason || null,
          customer_declined_at: new Date().toISOString(),
          customer_response_by: customer?.id || null,
          admin_notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;

      if (customer?.shop_id && order?.ro_number) {
        await supabase.functions.invoke('send-push', {
          body: {
            target: 'admin',
            shop_id: customer.shop_id,
            title: 'Repair Order Declined',
            message: `${order.ro_number} was declined by the customer`,
            url: '/',
          },
        });
        await supabase.from('notifications').insert({
          shop_id: customer.shop_id,
          recipient_role: 'admin',
          recipient_id: null,
          title: 'Repair Order Declined',
          body: `${order.ro_number} was declined by the customer`,
          entity_type: 'repair_order',
          entity_id: orderId,
          action_url: '/?tab=my_shop&sub=repair_orders',
        });
      }
      showMessage('success', 'Repair order declined');
      loadOrders();
    } catch (error) {
      console.error('Error declining repair order:', error);
      showMessage('error', 'Failed to decline repair order');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadTaxSettings = async (shopId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('tax_rate, taxable_item_types')
        .eq('shop_id', shopId)
        .maybeSingle();
      if (error) throw error;
      setTaxRate(Number((data as any)?.tax_rate || 0));
    } catch (error) {
      console.error('Failed to load tax settings:', error);
    }
  };

  const computeLineTotal = (item: RepairOrderItem) => {
    const lineTotal = item.item_type === 'labor'
      ? Number(item.labor_hours || 0) * Number(item.unit_price || 0)
      : Number(item.quantity || 0) * Number(item.unit_price || 0);
    return Number(lineTotal.toFixed(2));
  };

  const computeTotals = (items: RepairOrderItem[]) => {
    const eligible = items.filter((item) => item.status !== 'declined');
    const labor_total = eligible.filter((i) => i.item_type === 'labor').reduce((sum, i) => sum + computeLineTotal(i), 0);
    const parts_total = eligible.filter((i) => i.item_type === 'part').reduce((sum, i) => sum + computeLineTotal(i), 0);
    const fees_total = eligible.filter((i) => i.item_type === 'fee').reduce((sum, i) => sum + computeLineTotal(i), 0);
    const taxableSubtotal = eligible.filter((i) => i.taxable).reduce((sum, i) => sum + computeLineTotal(i), 0);
    const tax_total = Number((taxableSubtotal * (taxRate / 100)).toFixed(2));
    const grand_total = Number((labor_total + parts_total + fees_total + tax_total).toFixed(2));
    return { labor_total, parts_total, fees_total, tax_total, grand_total };
  };

  const updateLineItemStatus = async (order: RepairOrderWithItems, itemId: string, status: 'approved' | 'declined') => {
    try {
      const item = (order.items || []).find((entry) => entry.id === itemId);
      if (item?.parent_item_id) return;
      const { error } = await supabase
        .from('repair_order_items')
        .update({ status })
        .eq('id', itemId);
      if (error) throw error;

      const { error: childError } = await supabase
        .from('repair_order_items')
        .update({ status })
        .eq('parent_item_id', itemId);
      if (childError) throw childError;

      const nextItems = (order.items || []).map((entry) =>
        entry.id === itemId || entry.parent_item_id === itemId ? { ...entry, status } : entry
      );
      const totals = computeTotals(nextItems);
      await supabase
        .from('repair_orders')
        .update({ ...totals, status: 'awaiting_approval', updated_at: new Date().toISOString() })
        .eq('id', order.id);

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, items: nextItems, ...totals } : o))
      );
      showMessage('success', `Item ${status}`);
    } catch (error) {
      console.error('Failed to update line item:', error);
      showMessage('error', 'Failed to update line item');
    }
  };

  const getMediaForItem = (itemId: string) => dviMedia[itemId] || [];
  const getItemTitle = (item: DviReportItem) =>
    item.custom_title
    || item.item_title
    || item.recommendation
    || 'Inspection finding';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading repair orders...</div>
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Repair Orders Coming Soon</h3>
        <p className="text-slate-600">Repair order data will appear here once enabled by your shop.</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Repair Orders Yet</h3>
        <p className="text-slate-600">Your repair orders will appear here once your shop creates them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow"
              aria-label="Close image preview"
            >
              ✕
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.label}
              className="w-full max-h-[80vh] object-contain rounded-xl bg-black"
            />
          </div>
        </div>
      )}
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

      {orders.map((order) => {
        const hasPendingItems = (order.items || []).some((item) => !item.status || item.status === 'pending');
        return (
        <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{order.ro_number}</h3>
              <p className="text-sm text-slate-500">
                Created {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                {statusLabels[order.status]}
              </span>
              <button
                type="button"
                onClick={() => setExpandedOrders((prev) => ({ ...prev, [order.id]: !(prev[order.id] ?? true) }))}
                className="text-xs text-slate-500 flex items-center gap-1"
              >
                {expandedOrders[order.id] ?? false ? (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    Expand
                  </>
                )}
              </button>
            </div>
          </div>

          {(expandedOrders[order.id] ?? false) && (
            <>
              {(order.items || []).length === 0 ? (
                <p className="text-sm text-slate-600">No line items yet.</p>
              ) : (
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between p-3 border border-slate-200 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{item.description}</p>
                    <p className="text-xs text-slate-500">
                      {item.item_type.toUpperCase()} - {item.item_type === 'labor' ? `${item.labor_hours ?? 0} hrs` : `Qty ${item.quantity}`}
                    </p>
                    <span className={`inline-flex mt-1 text-xs px-2 py-0.5 rounded-full ${
                      item.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.status === 'declined'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.status || 'pending'}
                    </span>
                    {order.status === 'awaiting_approval' && !item.parent_item_id && item.status !== 'approved' && item.status !== 'declined' && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => updateLineItemStatus(order, item.id, 'approved')}
                          className="px-3 py-1 text-xs rounded-lg border border-emerald-200 text-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateLineItemStatus(order, item.id, 'declined')}
                          className="px-3 py-1 text-xs rounded-lg border border-rose-200 text-rose-700"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="font-semibold text-slate-900">${computeLineTotal(item).toFixed(2)}</div>
                </div>
              ))}
            </div>
              )}

              {(dviReports[order.id] || []).length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setExpandedDviReports((prev) => ({ ...prev, [order.id]: !(prev[order.id] ?? true) }))}
                    className="flex items-center gap-2 text-slate-700"
                  >
                    {(expandedDviReports[order.id] ?? false) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <ClipboardCheck className="w-4 h-4" />
                    <h4 className="font-semibold text-slate-900">Inspection Report</h4>
                  </button>
                  {(expandedDviReports[order.id] ?? false) && (
                    <>
                      {(dviReports[order.id] || []).map((report) => (
                        <div key={report.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                          {(dviItems[report.id] || []).map((item) => (
                            <div key={item.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-slate-900">{getItemTitle(item)}</p>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  item.condition === 'green'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : item.condition === 'yellow'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.condition.toUpperCase()}
                                </span>
                              </div>
                              {item.notes && <p className="text-xs text-slate-600 mt-2">{item.notes}</p>}
                              {getMediaForItem(item.id).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {getMediaForItem(item.id).map((media) => {
                                    const mediaUrl = dviMediaUrls[media.id];
                                    if (!mediaUrl) {
                                      return (
                                        <span key={media.id} className="text-xs text-slate-500">
                                          {media.file_name}
                                        </span>
                                      );
                                    }
                                    if (media.mime_type?.startsWith('image/')) {
                                      return (
                                        <button
                                          key={media.id}
                                          type="button"
                                          onClick={() => setLightboxImage({ url: mediaUrl, label: media.file_name })}
                                          className="block"
                                        >
                                          <img
                                            src={mediaUrl}
                                            alt={media.file_name}
                                            className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                                          />
                                        </button>
                                      );
                                    }
                                    if (media.mime_type?.startsWith('video/')) {
                                      return (
                                        <video
                                          key={media.id}
                                          src={mediaUrl}
                                          controls
                                          className="w-32 h-20 rounded-lg border border-slate-200"
                                        />
                                      );
                                    }
                                    if (media.mime_type?.startsWith('audio/')) {
                                      return (
                                        <audio key={media.id} src={mediaUrl} controls className="h-8" />
                                      );
                                    }
                                    return (
                                      <a
                                        key={media.id}
                                        href={mediaUrl}
                                        className="text-xs text-blue-600 underline"
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {media.file_name}
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              <div className="border-t border-slate-200 pt-4">
                <button
                  onClick={() => setExpandedChat((prev) => ({ ...prev, [order.id]: !prev[order.id] }))}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <MessageSquare className="w-4 h-4" />
                  {expandedChat[order.id] ? 'Hide Messages' : 'Message the Shop'}
                </button>
                {expandedChat[order.id] && (
                  <div className="mt-3">
                    <ChatThread
                      shopId={customer?.shop_id || ''}
                      customerId={customer?.id || ''}
                      repairOrderId={order.id}
                      threadType="ro"
                      title="Messages with your advisor"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Estimated total</span>
                <span className="text-lg font-semibold text-slate-900">
                  ${computeTotals(order.items || []).grand_total.toFixed(2)}
                </span>
              </div>

              {order.status === 'awaiting_approval' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApproveAll(order.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve all
                  </button>
                  <button
                    onClick={() => handleSendToShop(order.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg ${hasPendingItems ? 'opacity-60 cursor-not-allowed' : ''}`}
                    style={{ backgroundColor: brandSettings.primary_color }}
                    disabled={hasPendingItems}
                    title={hasPendingItems ? 'Approve or decline all items first' : undefined}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Send to shop
                  </button>
                  <button
                    onClick={() => handleDecline(order.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        );
      })}
    </div>
  );
}
