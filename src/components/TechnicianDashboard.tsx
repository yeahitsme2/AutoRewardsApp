import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { logAuditEvent } from '../lib/audit';
import { logOutboundMessage } from '../lib/messaging';
import { CheckCircle, ClipboardList, RefreshCcw, Square, Camera, AlertTriangle } from 'lucide-react';
import type { RepairOrder, DviReport, DviReportItem } from '../types/database';

type ReportWithItems = DviReport & {
  items: DviReportItem[];
};

export function TechnicianDashboard() {
  const { admin } = useAuth();
  const { brandSettings } = useBrand();
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>([]);
  const [reports, setReports] = useState<DviReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportItems, setReportItems] = useState<DviReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedReport = useMemo(() => {
    return reports.find((report) => report.id === selectedReportId) || null;
  }, [reports, selectedReportId]);

  const loadRepairOrders = async () => {
    if (!admin?.shop_id) return;
    try {
      const { data, error } = await supabase
        .from('repair_orders')
        .select('*')
        .eq('shop_id', admin.shop_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setRepairOrders((data || []) as RepairOrder[]);
    } catch (error) {
      console.error('Failed to load repair orders:', error);
      setRepairOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    if (!admin?.shop_id) return;
    try {
      const { data, error } = await supabase
        .from('dvi_reports')
        .select('*')
        .eq('shop_id', admin.shop_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setReports((data || []) as DviReport[]);
      if (!selectedReportId && data && data.length > 0) {
        setSelectedReportId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
      setReports([]);
    }
  };

  const loadReportItems = async (reportId: string) => {
    try {
      const { data, error } = await supabase
        .from('dvi_report_items')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setReportItems((data || []) as DviReportItem[]);
    } catch (error) {
      console.error('Failed to load report items:', error);
      setReportItems([]);
    }
  };

  useEffect(() => {
    if (selectedReportId) {
      loadReportItems(selectedReportId);
    } else if (reports.length > 0) {
      setSelectedReportId(reports[0].id);
    }
  }, [selectedReportId, reports]);

  useEffect(() => {
    if (!admin?.shop_id) return;
    loadRepairOrders();
    loadReports();
  }, [admin?.shop_id]);

  useEffect(() => {
    if (!admin?.shop_id) return;

    const channel = supabase
      .channel(`technician-ro-${admin.shop_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'repair_orders',
        filter: `shop_id=eq.${admin.shop_id}`,
      }, () => {
        loadRepairOrders();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dvi_reports',
        filter: `shop_id=eq.${admin.shop_id}`,
      }, () => {
        loadReports();
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin?.shop_id]);

  const handleSelectReport = (reportId: string) => {
    setSelectedReportId(reportId);
    loadReportItems(reportId);
  };

  const handleUpdateItem = async (itemId: string, updates: Partial<DviReportItem>) => {
    try {
      const { error } = await supabase
        .from('dvi_report_items')
        .update(updates)
        .eq('id', itemId);
      if (error) throw error;
      setReportItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
    } catch (error) {
      console.error('Failed to update report item:', error);
      showMessage('error', 'Failed to save findings');
    }
  };

  const handlePublishReport = async () => {
    if (!selectedReportId || !admin) return;
    try {
      const { error } = await supabase
        .from('dvi_reports')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', selectedReportId);
      if (error) throw error;

      await logAuditEvent({
        shopId: admin.shop_id,
        actorRole: 'technician',
        eventType: 'dvi_report_published',
        entityType: 'dvi_report',
        entityId: selectedReportId,
      });

      if (selectedReport?.customer_id) {
        await logOutboundMessage({
          shopId: admin.shop_id,
          customerId: selectedReport.customer_id,
          channel: 'email',
          subject: 'Documented inspection is ready',
          body: 'Your technician completed the inspection and the report is now available in the app.',
          status: 'queued',
        });
      }

      showMessage('success', 'Inspection published');
      loadReports();
    } catch (error) {
      console.error('Failed to publish report:', error);
      showMessage('error', 'Failed to publish report');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const openOrders = repairOrders.filter((ro) => ro.status !== 'completed');

  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Technician workspace</p>
              <h1 className="text-3xl font-bold text-slate-900">Vehicle inspections & repairs</h1>
            </div>
            <button
              onClick={() => {
                loadRepairOrders();
                loadReports();
                if (selectedReportId) {
                  loadReportItems(selectedReportId);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 hover:border-slate-400"
            >
              <RefreshCcw className="w-4 h-4 text-slate-600" />
              Refresh
            </button>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Track open repair orders, update the inspection checklist, and publish DVIs for customers.
          </p>
        </header>

        {message && (
          <div
            className={`p-4 rounded-lg text-sm font-medium ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Open repair orders</h2>
                <p className="text-xs text-slate-500">
                  {openOrders.length} order{openOrders.length === 1 ? '' : 's'} waiting for inspection
                </p>
              </div>
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {openOrders.length === 0 && (
                <div className="text-sm text-slate-500">No open orders right now.</div>
              )}
              {openOrders.map((order) => {
                const report = reports.find((report) => report.repair_order_id === order.id);
                return (
                  <button
                    key={order.id}
                    onClick={() => report && handleSelectReport(report.id)}
                    className={`w-full text-left border rounded-2xl p-3 transition ${
                      report?.id === selectedReportId ? 'border-slate-400 shadow-sm bg-slate-50' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900">{order.ro_number}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                        {order.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {order.temp_customer_name || `Customer ${order.customer_id?.slice(0, 6)}...`}
                      {' • '}
                      {report ? `Inspection ${report.status}` : 'No inspection yet'}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Inspection report</h2>
                {selectedReport ? (
                  <p className="text-xs text-slate-500">Report #{selectedReport.id.slice(0, 8)}</p>
                ) : (
                  <p className="text-xs text-slate-500">Select an order to view the inspection checklist.</p>
                )}
              </div>
              {selectedReport && (
                <button
                  onClick={handlePublishReport}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white rounded-lg"
                  style={{ backgroundColor: brandSettings.primary_color }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Publish DVI
                </button>
              )}
            </div>

            {!selectedReport && (
              <div className="p-4 rounded-xl bg-slate-50 text-sm text-slate-500">
                Pick a repair order from the list to see and update the default inspection items.
              </div>
            )}

            {selectedReport && (
              <div className="space-y-3 max-h-[520px] overflow-y-auto">
                {reportItems.length === 0 && (
                  <div className="text-sm text-slate-500">Loading inspection items...</div>
                )}
                {reportItems.map((item) => (
                  <div key={item.id} className="border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{item.recommendation || 'Inspection item'}</p>
                      <select
                        value={item.condition}
                        onChange={(event) => handleUpdateItem(item.id, { condition: event.target.value as DviReportItem['condition'] })}
                        className="px-2 py-1 text-xs border border-slate-300 rounded-lg"
                      >
                        <option value="green">Green</option>
                        <option value="yellow">Yellow</option>
                        <option value="red">Red</option>
                      </select>
                    </div>
                    <textarea
                      value={item.notes || ''}
                      onChange={(event) => handleUpdateItem(item.id, { notes: event.target.value })}
                      placeholder="Add notes for this finding"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-slate-400 focus:ring-0 resize-none"
                      rows={2}
                    />
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{item.condition.toUpperCase()} status</span>
                      <span>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
