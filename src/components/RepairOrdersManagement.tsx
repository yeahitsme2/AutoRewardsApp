import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { AlertCircle, CheckCircle, ClipboardList, DollarSign, Plus, Save, User, Car, X } from 'lucide-react';
import type { Customer, RepairOrder, RepairOrderItem, RepairOrderMarkupRule, Vehicle } from '../types/database';

interface RepairOrderWithDetails extends RepairOrder {
  customer?: Customer;
  vehicle?: Vehicle | null;
  items?: RepairOrderItem[];
}

type RepairOrderStatus = RepairOrder['status'];

const statusOptions: RepairOrderStatus[] = ['draft', 'awaiting_approval', 'approved', 'declined', 'closed'];

const statusLabels: Record<RepairOrderStatus, string> = {
  draft: 'Draft',
  awaiting_approval: 'Awaiting Approval',
  approved: 'Approved',
  declined: 'Declined',
  closed: 'Closed',
};

const statusStyles: Record<RepairOrderStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
  awaiting_approval: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  declined: { bg: 'bg-red-100', text: 'text-red-700' },
  closed: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

const emptyItem = {
  item_type: 'labor' as RepairOrderItem['item_type'],
  description: '',
  quantity: 1,
  cost: 0,
  unit_price: 0,
  taxable: false,
};

const generateRoNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RO-${datePart}-${rand}`;
};

const roundToCents = (value: number) => Math.round(value * 100) / 100;

export function RepairOrdersManagement() {
  const { admin } = useAuth();
  const { brandSettings } = useBrand();
  const [orders, setOrders] = useState<RepairOrderWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [markupRules, setMarkupRules] = useState<RepairOrderMarkupRule[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({
    customer_id: '',
    vehicle_id: '',
    internal_notes: '',
  });
  const [itemDrafts, setItemDrafts] = useState<Record<string, typeof emptyItem>>({});

  useEffect(() => {
    loadOrders();
    loadCustomers();
    loadVehicles();
    loadMarkupRules();
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

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

      setOrders(nextOrders);
    } catch (error) {
      console.error('Error loading repair orders:', error);
    } finally {
      setLoading(false);
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

  const computeTotals = (items: RepairOrderItem[]) => {
    const labor_total = items.filter((i) => i.item_type === 'labor').reduce((sum, i) => sum + i.total, 0);
    const parts_total = items.filter((i) => i.item_type === 'part').reduce((sum, i) => sum + i.total, 0);
    const fees_total = items.filter((i) => i.item_type === 'fee').reduce((sum, i) => sum + i.total, 0);
    const tax_total = 0;
    const grand_total = labor_total + parts_total + fees_total + tax_total;
    return { labor_total, parts_total, fees_total, tax_total, grand_total };
  };

  const updateOrderTotals = async (orderId: string, items: RepairOrderItem[]) => {
    const totals = computeTotals(items);
    const { error } = await supabase
      .from('repair_orders')
      .update({ ...totals, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw error;
    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, ...totals } : order))
    );
  };

  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find((o) => o.id === orderId);
    if (order && !order.items) {
      try {
        await loadItems(orderId);
      } catch (error) {
        console.error('Error loading RO items:', error);
      }
    }
  };

  const handleStatusChange = async (orderId: string, status: RepairOrderStatus) => {
    try {
      const updates: Partial<RepairOrder> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'approved') updates.approved_at = new Date().toISOString();
      if (status === 'closed') updates.closed_at = new Date().toISOString();

      const { error } = await supabase
        .from('repair_orders')
        .update(updates)
        .eq('id', orderId);
      if (error) throw error;

      showMessage('success', 'Repair order updated');
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, ...updates } as RepairOrderWithDetails : order))
      );
    } catch (error) {
      console.error('Error updating RO status:', error);
      showMessage('error', 'Failed to update repair order');
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
        const quantityValue = Number(draft.quantity);
        if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
          showMessage('error', 'Quantity must be greater than 0');
          return;
        }
        const unitPriceValue = roundToCents(Number(draft.unit_price));
        const total = roundToCents(quantityValue * unitPriceValue);
        const { data, error } = await supabase
          .from('repair_order_items')
          .insert({
            repair_order_id: orderId,
            item_type: draft.item_type,
            description: draft.description.trim(),
            quantity: quantityValue,
            unit_price: unitPriceValue,
            total,
            taxable: Boolean(draft.taxable),
          })
        .select('*')
        .single();

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const nextItems = [...(order.items || []), data as RepairOrderItem];
          return { ...order, items: nextItems };
        })
      );
      setItemDrafts((prev) => ({ ...prev, [orderId]: { ...emptyItem } }));
      const updatedOrder = orders.find((order) => order.id === orderId);
      const nextItems = [...(updatedOrder?.items || []), data as RepairOrderItem];
      await updateOrderTotals(orderId, nextItems);
      showMessage('success', 'Item added');
    } catch (error) {
      console.error('Error adding item:', error);
      showMessage('error', 'Failed to add item');
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
            {orders
              .filter((order) => order.status !== 'closed')
              .map((order) => (
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
            {orders.map((order) => (
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
                  ${order.grand_total.toFixed(2)}
                </div>
              </button>
            ))}
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
                    onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value as RepairOrderStatus)}
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
                  <h4 className="font-semibold text-slate-900">Line Items</h4>
                  {(selectedOrder.items || []).length === 0 ? (
                    <div className="text-sm text-slate-600">No line items yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedOrder.items?.map((item) => (
                        <div key={item.id} className="flex items-start justify-between p-3 border border-slate-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">{item.description}</p>
                            <p className="text-xs text-slate-500">
                              {item.item_type.toUpperCase()} • Qty {item.quantity} • ${item.unit_price.toFixed(2)}
                            </p>
                          </div>
                          <div className="font-semibold text-slate-900">${item.total.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-slate-900">Add Line Item</h4>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <select
                        value={(itemDrafts[selectedOrder.id] || emptyItem).item_type}
                        onChange={(e) => setItemDrafts((prev) => ({
                          ...prev,
                          [selectedOrder.id]: {
                            ...(prev[selectedOrder.id] || emptyItem),
                            item_type: e.target.value as RepairOrderItem['item_type'],
                            unit_price: e.target.value === 'part'
                              ? (() => {
                                const costValue = Number((prev[selectedOrder.id] || emptyItem).cost || 0);
                                const markup = getMarkupPercent(costValue);
                                return roundToCents(costValue + (costValue * markup / 100));
                              })()
                              : (prev[selectedOrder.id] || emptyItem).unit_price,
                          },
                        }))}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="labor">Labor</option>
                        <option value="part">Part</option>
                        <option value="fee">Fee</option>
                    </select>
                    <input
                      value={(itemDrafts[selectedOrder.id] || emptyItem).description}
                      onChange={(e) => setItemDrafts((prev) => ({
                        ...prev,
                        [selectedOrder.id]: { ...(prev[selectedOrder.id] || emptyItem), description: e.target.value },
                      }))}
                      placeholder="Description"
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm md:col-span-2"
                    />
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
                      />
                      {(itemDrafts[selectedOrder.id] || emptyItem).item_type === 'part' && (
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
                  </div>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    <AlertCircle className="w-4 h-4" />
                    Status: {statusLabels[selectedOrder.status]}
                  </div>
                  <div className="text-right space-y-1 text-sm">
                    <div>Labor: ${selectedOrder.labor_total.toFixed(2)}</div>
                    <div>Parts: ${selectedOrder.parts_total.toFixed(2)}</div>
                    <div>Fees: ${selectedOrder.fees_total.toFixed(2)}</div>
                    <div className="font-semibold text-slate-900">Total: ${selectedOrder.grand_total.toFixed(2)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleStatusChange(selectedOrder.id, 'awaiting_approval')}
                    className="flex items-center gap-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Send for Approval
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedOrder.id, 'approved')}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Approved
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedOrder.id, 'closed')}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Close RO
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
