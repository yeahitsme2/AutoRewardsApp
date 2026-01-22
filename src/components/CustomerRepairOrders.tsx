import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { FileText, Calendar, DollarSign, Wrench, Download, Eye, Package, Settings } from 'lucide-react';
import type { RepairOrder, Vehicle } from '../types/database';

interface RepairOrderWithVehicle extends RepairOrder {
  vehicle?: Vehicle | null;
}

export function CustomerRepairOrders() {
  const { customer } = useAuth();
  const [repairOrders, setRepairOrders] = useState<RepairOrderWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customer?.id) {
      loadRepairOrders();
    }
  }, [customer?.id]);

  const loadRepairOrders = async () => {
    if (!customer?.id) return;

    try {
      const { data, error } = await supabase
        .from('repair_orders')
        .select('*, vehicle:vehicles(*)')
        .eq('customer_id', customer.id)
        .order('service_date', { ascending: false });

      if (error) throw error;
      setRepairOrders(data || []);
    } catch (error) {
      console.error('Error loading repair orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (order: RepairOrder) => {
    window.open(order.file_url, '_blank');
  };

  const handleDownload = async (order: RepairOrder) => {
    try {
      const fileName = order.file_url.split('/').pop();
      if (!fileName) return;

      const filePath = `${order.shop_id}/${fileName}`;
      const { data, error } = await supabase.storage
        .from('repair-orders')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `repair_order_${order.service_date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading repair order:', error);
      alert('Failed to download repair order: ' + (error?.message || 'Unknown error'));
    }
  };

  if (loading) {
    return <div className="text-slate-600">Loading your repair orders...</div>;
  }

  if (repairOrders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Repair Orders Yet</h3>
        <p className="text-slate-600">
          Your service history will appear here once repair orders are uploaded
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">My Repair Orders</h2>
        <p className="text-slate-600">View and download your complete service history</p>
      </div>

      <div className="space-y-4">
        {repairOrders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      Service Record
                    </h3>
                    <span className="text-sm text-slate-400">|</span>
                    <div className="flex items-center gap-1 text-slate-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(order.service_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                  {order.vehicle && (
                    <div className="flex items-center gap-2 text-slate-700 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Wrench className="w-4 h-4 text-slate-600" />
                      </div>
                      <span className="font-semibold">
                        {order.vehicle.year} {order.vehicle.make} {order.vehicle.model}
                      </span>
                      {order.vehicle.license_plate && (
                        <span className="text-sm text-slate-500">
                          ({order.vehicle.license_plate})
                        </span>
                      )}
                    </div>
                  )}
                  {order.notes && (
                    <p className="text-slate-600 mb-3 leading-relaxed">{order.notes}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium">Total Amount</p>
                    <p className="text-lg font-bold text-slate-900">
                      ${order.total_amount.toFixed(2)}
                    </p>
                  </div>
                </div>

                {order.parts_cost > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Package className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium">Parts</p>
                      <p className="text-lg font-semibold text-slate-900">
                        ${order.parts_cost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                {order.labor_cost > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium">Labor</p>
                      <p className="text-lg font-semibold text-slate-900">
                        ${order.labor_cost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {order.service_writer && (
                <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
                  <Wrench className="w-4 h-4" />
                  <span>Service Writer: <span className="font-medium">{order.service_writer}</span></span>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => handleView(order)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Eye className="w-5 h-5" />
                  View Document
                </button>
                <button
                  onClick={() => handleDownload(order)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
