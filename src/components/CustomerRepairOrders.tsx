import { useEffect, useRef, useState } from 'react';
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
  const [templateItemTitles, setTemplateItemTitles] = useState<Record<string, string>>({});
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [expandedDviReports, setExpandedDviReports] = useState<Record<string, boolean>>({});
  const [expandedChat, setExpandedChat] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const prevStatusRef = useRef<Record<string, RepairOrder['status']>>({});

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

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
          || error.status === 404
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
      const templateItemIds = reportItemList
        .map((item) => item.template_item_id)
        .filter(Boolean) as string[];
      if (templateItemIds.length > 0) {
        const { data: templateRows, error: templateError } = await supabase
          .from('dvi_template_items')
          .select('id, title')
          .in('id', templateItemIds);
        if (templateError) throw templateError;
        const templateMap: Record<string, string> = {};
        (templateRows || []).forEach((row) => {
          templateMap[row.id] = row.title;
        });
        setTemplateItemTitles(templateMap);
      } else {
        setTemplateItemTitles({});
      }
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
      const mediaUrlMap: Record<string, string> = {};
      await Promise.all(
        (mediaRows || []).map(async (media) => {
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
      setDviMediaUrls(mediaUrlMap);
    } catch (error) {
      console.error('Error loading repair orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId: string) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      const { error } = await supabase
        .from('repair_orders')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          customer_approved_at: new Date().toISOString(),
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
            title: 'Repair Order Approved',
            message: `${order.ro_number} was approved by the customer`,
            url: '/',
          },
        });
      }
      showMessage('success', 'Repair order approved');
      loadOrders();
    } catch (error) {
      console.error('Error approving repair order:', error);
      showMessage('error', 'Failed to approve repair order');
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

  const getMediaForItem = (itemId: string) => dviMedia[itemId] || [];
  const getItemTitle = (item: DviReportItem) =>
    item.custom_title
    || (item.template_item_id ? templateItemTitles[item.template_item_id] : null)
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

      {orders.map((order) => (
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
                          {item.item_type.toUpperCase()} - Qty {item.quantity} - ${item.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <div className="font-semibold text-slate-900">${item.total.toFixed(2)}</div>
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
                                        <img
                                          key={media.id}
                                          src={mediaUrl}
                                          alt={media.file_name}
                                          className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                                        />
                                      );
                                    }
                                    if (media.mime_type?.startsWith('video/')) {
                                      return (
                                        <video key={media.id} src={mediaUrl} controls className="w-32 h-20 rounded-lg border border-slate-200" />
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
                <span className="text-lg font-semibold text-slate-900">${order.grand_total.toFixed(2)}</span>
              </div>

              {order.status === 'awaiting_approval' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApprove(order.id)}
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                    style={{ backgroundColor: brandSettings.primary_color }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
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
      ))}
    </div>
  );
}
