import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { logAuditEvent } from '../lib/audit';
import { Boxes, Plus, ShoppingCart, Truck, AlertTriangle } from 'lucide-react';
import type { InventoryTransaction, Part, PartLocation, PurchaseOrder, PurchaseOrderLine, ShopLocation, Vendor } from '../types/database';

type InventoryTab = 'parts' | 'stock' | 'vendors' | 'purchase_orders' | 'transactions';

type LineDraft = {
  part_id: string;
  quantity: number;
  unit_cost: number;
};

export function InventoryManagement() {
  const { admin } = useAuth();
  const { brandSettings } = useBrand();
  const [activeTab, setActiveTab] = useState<InventoryTab>('parts');
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [partLocations, setPartLocations] = useState<PartLocation[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseLines, setPurchaseLines] = useState<PurchaseOrderLine[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newPart, setNewPart] = useState({
    name: '',
    sku: '',
    unit_cost: 0,
    unit_price: 0,
    taxable: true,
    reorder_threshold: 0,
  });
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', email: '', address: '' });
  const [stockAdjustment, setStockAdjustment] = useState({
    part_id: '',
    location_id: '',
    quantity: 0,
  });
  const [poDraft, setPoDraft] = useState({
    vendor_id: '',
    location_id: '',
    notes: '',
  });
  const [poLines, setPoLines] = useState<LineDraft[]>([{ part_id: '', quantity: 1, unit_cost: 0 }]);

  useEffect(() => {
    if (!admin?.shop_id) return;
    loadAll();
  }, [admin?.shop_id]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadAll = async () => {
    await Promise.all([
      loadLocations(),
      loadParts(),
      loadVendors(),
      loadPartLocations(),
      loadPurchaseOrders(),
      loadTransactions(),
    ]);
  };

  const loadLocations = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('shop_locations')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to load locations:', error);
      setLocations([]);
      return;
    }
    setLocations((data || []) as ShopLocation[]);
  };

  const ensureDefaultLocation = async () => {
    if (!admin?.shop_id) return;
    if (locations.length > 0) return;
    const { data, error } = await supabase
      .from('shop_locations')
      .insert({
        shop_id: admin.shop_id,
        name: 'Main Location',
        is_active: true,
      })
      .select('*')
      .single();
    if (error) {
      console.error('Failed to create default location:', error);
      return;
    }
    setLocations([data as ShopLocation]);
  };

  const loadParts = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load parts:', error);
      setParts([]);
      return;
    }
    setParts((data || []) as Part[]);
  };

  const loadVendors = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load vendors:', error);
      setVendors([]);
      return;
    }
    setVendors((data || []) as Vendor[]);
  };

  const loadPartLocations = async () => {
    const { data, error } = await supabase.from('part_locations').select('*');
    if (error) {
      console.error('Failed to load stock:', error);
      setPartLocations([]);
      return;
    }
    setPartLocations((data || []) as PartLocation[]);
  };

  const loadPurchaseOrders = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load POs:', error);
      setPurchaseOrders([]);
      return;
    }
    setPurchaseOrders((data || []) as PurchaseOrder[]);
    const poIds = (data || []).map((po) => po.id);
    if (poIds.length > 0) {
      const { data: lines, error: linesError } = await supabase
        .from('purchase_order_lines')
        .select('*')
        .in('purchase_order_id', poIds);
      if (!linesError) {
        setPurchaseLines((lines || []) as PurchaseOrderLine[]);
      }
    }
  };

  const loadTransactions = async () => {
    if (!admin?.shop_id) return;
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Failed to load transactions:', error);
      setTransactions([]);
      return;
    }
    setTransactions((data || []) as InventoryTransaction[]);
  };

  const handleCreatePart = async () => {
    if (!admin?.shop_id || !newPart.name.trim()) {
      showMessage('error', 'Enter a part name');
      return;
    }
    try {
      const { error } = await supabase.from('parts').insert({
        shop_id: admin.shop_id,
        name: newPart.name.trim(),
        sku: newPart.sku || null,
        unit_cost: Number(newPart.unit_cost || 0),
        unit_price: Number(newPart.unit_price || 0),
        taxable: Boolean(newPart.taxable),
        reorder_threshold: Number(newPart.reorder_threshold || 0),
      });
      if (error) throw error;
      showMessage('success', 'Part created');
      setNewPart({ name: '', sku: '', unit_cost: 0, unit_price: 0, taxable: true, reorder_threshold: 0 });
      loadParts();
    } catch (error) {
      console.error('Failed to create part:', error);
      showMessage('error', 'Failed to create part');
    }
  };

  const handleCreateVendor = async () => {
    if (!admin?.shop_id || !newVendor.name.trim()) {
      showMessage('error', 'Enter a vendor name');
      return;
    }
    try {
      const { error } = await supabase.from('vendors').insert({
        shop_id: admin.shop_id,
        name: newVendor.name.trim(),
        phone: newVendor.phone || null,
        email: newVendor.email || null,
        address: newVendor.address || null,
      });
      if (error) throw error;
      showMessage('success', 'Vendor created');
      setNewVendor({ name: '', phone: '', email: '', address: '' });
      loadVendors();
    } catch (error) {
      console.error('Failed to create vendor:', error);
      showMessage('error', 'Failed to create vendor');
    }
  };

  const handleAdjustStock = async () => {
    if (!admin?.shop_id) return;
    if (!stockAdjustment.part_id || !stockAdjustment.location_id || stockAdjustment.quantity === 0) {
      showMessage('error', 'Select part, location, and quantity');
      return;
    }
    try {
      const { error } = await supabase.from('inventory_transactions').insert({
        shop_id: admin.shop_id,
        location_id: stockAdjustment.location_id,
        part_id: stockAdjustment.part_id,
        transaction_type: 'adjust',
        quantity: Number(stockAdjustment.quantity),
        reference_type: 'adjustment',
      });
      if (error) throw error;
      await logAuditEvent({
        shopId: admin.shop_id,
        actorRole: 'admin',
        eventType: 'inventory_adjustment',
        entityType: 'part',
        entityId: stockAdjustment.part_id,
        metadata: { quantity: Number(stockAdjustment.quantity), location_id: stockAdjustment.location_id },
      });
      showMessage('success', 'Stock adjusted');
      setStockAdjustment({ part_id: '', location_id: '', quantity: 0 });
      loadPartLocations();
      loadTransactions();
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      showMessage('error', 'Failed to adjust stock');
    }
  };

  const handleCreatePurchaseOrder = async () => {
    if (!admin?.shop_id) return;
    if (!poDraft.vendor_id || !poDraft.location_id) {
      showMessage('error', 'Select vendor and location');
      return;
    }
    const validLines = poLines.filter((line) => line.part_id && line.quantity > 0);
    if (validLines.length === 0) {
      showMessage('error', 'Add at least one line item');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
          shop_id: admin.shop_id,
          vendor_id: poDraft.vendor_id,
          location_id: poDraft.location_id,
          status: 'sent',
          notes: poDraft.notes || null,
        })
        .select('*')
        .single();
      if (error) throw error;
      const { error: lineError } = await supabase.from('purchase_order_lines').insert(
        validLines.map((line) => ({
          purchase_order_id: (data as PurchaseOrder).id,
          part_id: line.part_id,
          quantity: Number(line.quantity),
          unit_cost: Number(line.unit_cost || 0),
          received_qty: 0,
        }))
      );
      if (lineError) throw lineError;
      setPoDraft({ vendor_id: '', location_id: '', notes: '' });
      setPoLines([{ part_id: '', quantity: 1, unit_cost: 0 }]);
      showMessage('success', 'Purchase order created');
      loadPurchaseOrders();
    } catch (error) {
      console.error('Failed to create PO:', error);
      showMessage('error', 'Failed to create purchase order');
    }
  };

  const handleReceivePurchaseOrder = async (po: PurchaseOrder) => {
    if (!admin?.shop_id || !po.location_id) return;
    try {
      const lines = purchaseLines.filter((line) => line.purchase_order_id === po.id);
      const transactions = lines.map((line) => ({
        shop_id: admin.shop_id,
        location_id: po.location_id,
        part_id: line.part_id,
        transaction_type: 'receive',
        quantity: line.quantity,
        reference_type: 'po',
        reference_id: po.id,
      }));
      if (transactions.length > 0) {
        const { error } = await supabase.from('inventory_transactions').insert(transactions);
        if (error) throw error;
      }
      await supabase
        .from('purchase_order_lines')
        .update({ received_qty: 0 })
        .eq('purchase_order_id', po.id);
      const lineUpdates = lines.map((line) =>
        supabase
          .from('purchase_order_lines')
          .update({ received_qty: line.quantity })
          .eq('id', line.id)
      );
      await Promise.all(lineUpdates);
      await supabase
        .from('purchase_orders')
        .update({ status: 'received', updated_at: new Date().toISOString() })
        .eq('id', po.id);
      await logAuditEvent({
        shopId: admin.shop_id,
        actorRole: 'admin',
        eventType: 'purchase_order_received',
        entityType: 'purchase_order',
        entityId: po.id,
      });
      showMessage('success', 'Purchase order received');
      loadPartLocations();
      loadPurchaseOrders();
      loadTransactions();
    } catch (error) {
      console.error('Failed to receive PO:', error);
      showMessage('error', 'Failed to receive PO');
    }
  };

  const lowStockParts = useMemo(() => {
    return partLocations.filter((loc) => loc.on_hand <= loc.reorder_threshold);
  }, [partLocations]);

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventory</h2>
          <p className="text-slate-600">Track parts, vendors, purchasing, and stock movement.</p>
        </div>
        {locations.length === 0 && (
          <button
            onClick={ensureDefaultLocation}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm"
          >
            Create Main Location
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['parts', 'stock', 'vendors', 'purchase_orders', 'transactions'] as InventoryTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab ? 'text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
            style={activeTab === tab ? { backgroundColor: brandSettings.primary_color } : undefined}
          >
            {tab === 'parts' && 'Parts Catalog'}
            {tab === 'stock' && 'Stock'}
            {tab === 'vendors' && 'Vendors'}
            {tab === 'purchase_orders' && 'Purchase Orders'}
            {tab === 'transactions' && 'Transactions'}
          </button>
        ))}
      </div>

      {activeTab === 'parts' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Boxes className="w-5 h-5" />
            <h3 className="font-semibold text-slate-900">Parts Catalog</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              value={newPart.name}
              onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
              placeholder="Part name"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm md:col-span-2"
            />
            <input
              value={newPart.sku}
              onChange={(e) => setNewPart({ ...newPart, sku: e.target.value })}
              placeholder="SKU"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="number"
              value={newPart.unit_cost}
              onChange={(e) => setNewPart({ ...newPart, unit_cost: Number(e.target.value) })}
              placeholder="Unit cost"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              type="number"
              value={newPart.unit_price}
              onChange={(e) => setNewPart({ ...newPart, unit_price: Number(e.target.value) })}
              placeholder="Unit price"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="number"
              value={newPart.reorder_threshold}
              onChange={(e) => setNewPart({ ...newPart, reorder_threshold: Number(e.target.value) })}
              placeholder="Reorder threshold"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={newPart.taxable}
                onChange={(e) => setNewPart({ ...newPart, taxable: e.target.checked })}
              />
              Taxable
            </label>
            <button
              onClick={handleCreatePart}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
              style={{ backgroundColor: brandSettings.primary_color }}
            >
              <Plus className="w-4 h-4" />
              Add Part
            </button>
          </div>
          <div className="space-y-2">
            {parts.map((part) => (
              <div key={part.id} className="border border-slate-200 rounded-lg p-3 text-sm flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{part.name}</p>
                  <p className="text-xs text-slate-500">{part.sku || 'No SKU'}</p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <div>Cost ${part.unit_cost.toFixed(2)}</div>
                  <div>Price ${part.unit_price.toFixed(2)}</div>
                </div>
              </div>
            ))}
            {parts.length === 0 && <p className="text-sm text-slate-500">No parts yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-4">
          {lowStockParts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2 text-sm text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              {lowStockParts.length} part(s) are at or below reorder threshold.
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Adjust Stock</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={stockAdjustment.part_id}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, part_id: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select part</option>
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>{part.name}</option>
                ))}
              </select>
              <select
                value={stockAdjustment.location_id}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, location_id: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={stockAdjustment.quantity}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: Number(e.target.value) })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="+/- qty"
              />
              <button
                onClick={handleAdjustStock}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                style={{ backgroundColor: brandSettings.primary_color }}
              >
                Adjust
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-semibold text-slate-900">Stock Levels</h3>
            {partLocations.length === 0 && <p className="text-sm text-slate-500">No stock recorded yet.</p>}
            {partLocations.map((loc) => {
              const part = parts.find((p) => p.id === loc.part_id);
              const location = locations.find((l) => l.id === loc.location_id);
              return (
                <div key={loc.id} className="border border-slate-200 rounded-lg p-3 text-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{part?.name || 'Part'}</p>
                    <p className="text-xs text-slate-500">{location?.name || 'Location'}</p>
                  </div>
                  <div className="text-right text-xs text-slate-600">
                    <div>On hand: {loc.on_hand}</div>
                    <div>Reserved: {loc.reserved}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'vendors' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Truck className="w-5 h-5" />
            <h3 className="font-semibold text-slate-900">Vendors</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={newVendor.name}
              onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
              placeholder="Vendor name"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              value={newVendor.phone}
              onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
              placeholder="Phone"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              value={newVendor.email}
              onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
              placeholder="Email"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <input
              value={newVendor.address}
              onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
              placeholder="Address"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={handleCreateVendor}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
            style={{ backgroundColor: brandSettings.primary_color }}
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>
          <div className="space-y-2">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="border border-slate-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-slate-900">{vendor.name}</p>
                <p className="text-xs text-slate-500">{vendor.email || vendor.phone || 'No contact info'}</p>
              </div>
            ))}
            {vendors.length === 0 && <p className="text-sm text-slate-500">No vendors yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'purchase_orders' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-700">
              <ShoppingCart className="w-5 h-5" />
              <h3 className="font-semibold text-slate-900">Create Purchase Order</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={poDraft.vendor_id}
                onChange={(e) => setPoDraft({ ...poDraft, vendor_id: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
              <select
                value={poDraft.location_id}
                onChange={(e) => setPoDraft({ ...poDraft, location_id: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <input
                value={poDraft.notes}
                onChange={(e) => setPoDraft({ ...poDraft, notes: e.target.value })}
                placeholder="Notes"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            {poLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={line.part_id}
                  onChange={(e) => {
                    const next = [...poLines];
                    next[idx] = { ...line, part_id: e.target.value };
                    setPoLines(next);
                  }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Select part</option>
                  {parts.map((part) => (
                    <option key={part.id} value={part.id}>{part.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => {
                    const next = [...poLines];
                    next[idx] = { ...line, quantity: Number(e.target.value) };
                    setPoLines(next);
                  }}
                  placeholder="Qty"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <input
                  type="number"
                  value={line.unit_cost}
                  onChange={(e) => {
                    const next = [...poLines];
                    next[idx] = { ...line, unit_cost: Number(e.target.value) };
                    setPoLines(next);
                  }}
                  placeholder="Unit cost"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => setPoLines(poLines.filter((_, lineIdx) => lineIdx !== idx))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPoLines([...poLines, { part_id: '', quantity: 1, unit_cost: 0 }])}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                Add Line
              </button>
              <button
                onClick={handleCreatePurchaseOrder}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                style={{ backgroundColor: brandSettings.primary_color }}
              >
                Create PO
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-semibold text-slate-900">Purchase Orders</h3>
            {purchaseOrders.map((po) => (
              <div key={po.id} className="border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{po.id.slice(0, 8)}...</p>
                    <p className="text-xs text-slate-500">Status: {po.status}</p>
                  </div>
                  <button
                    onClick={() => handleReceivePurchaseOrder(po)}
                    disabled={po.status === 'received' || po.status === 'closed'}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50"
                  >
                    Receive
                  </button>
                </div>
                <div className="text-xs text-slate-500">
                  Lines: {purchaseLines.filter((line) => line.purchase_order_id === po.id).length}
                </div>
              </div>
            ))}
            {purchaseOrders.length === 0 && <p className="text-sm text-slate-500">No purchase orders yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
          {transactions.map((tx) => (
            <div key={tx.id} className="border border-slate-200 rounded-lg p-3 text-sm flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{tx.transaction_type.toUpperCase()}</p>
                <p className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleString()}</p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <div>Qty {tx.quantity}</div>
                <div>{tx.reference_type || 'manual'}</div>
              </div>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-slate-500">No transactions yet.</p>}
        </div>
      )}
    </div>
  );
}
