import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { logAuditEvent } from '../lib/audit';
import { Boxes, Plus, ShoppingCart, Truck, AlertTriangle, Package, Search, CheckCircle, RefreshCcw, CreditCard as Edit2, X, Eye, ArrowRight } from 'lucide-react';
import type { InventoryTransaction, Part, PartLocation, PurchaseOrder, PurchaseOrderLine, RepairOrder, RepairOrderPartReservation, ShopLocation, Vendor } from '../types/database';

type MainView = 'overview' | 'parts' | 'orders' | 'receiving';

type LineDraft = {
  part_id: string;
  quantity: number;
  unit_cost: number;
};

type PartsNeededRow = {
  reservation: RepairOrderPartReservation;
  order: RepairOrder;
  part: Part;
  location?: ShopLocation | null;
  vendor?: Vendor | null;
};

export function InventoryManagement() {
  const { admin } = useAuth();
  const { brandSettings } = useBrand();
  const [mainView, setMainView] = useState<MainView>('overview');
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [partLocations, setPartLocations] = useState<PartLocation[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseLines, setPurchaseLines] = useState<PurchaseOrderLine[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [partsNeeded, setPartsNeeded] = useState<PartsNeededRow[]>([]);
  const [selectedNeededIds, setSelectedNeededIds] = useState<Record<string, boolean>>({});
  const [receivingPoId, setReceivingPoId] = useState<string>('');
  const [scanInput, setScanInput] = useState('');
  const [partsSearch, setPartsSearch] = useState('');
  const [partsQuery, setPartsQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out' | 'low'>('all');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [editPartDraft, setEditPartDraft] = useState<Partial<Part>>({});
  const [editLocationDraft, setEditLocationDraft] = useState<Partial<PartLocation>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewPartModal, setShowNewPartModal] = useState(false);
  const [showNewVendorModal, setShowNewVendorModal] = useState(false);
  const [showNewPOModal, setShowNewPOModal] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [newPart, setNewPart] = useState({
    name: '',
    sku: '',
    vendor_id: '',
    vendor_sku: '',
    category: '',
    unit_cost: 0,
    unit_price: 0,
    taxable: true,
  });
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', email: '', address: '' });
  const [stockAdjustment, setStockAdjustment] = useState({
    part_id: '',
    location_id: '',
    quantity: '',
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

  useEffect(() => {
    if (!admin?.shop_id) return;
    loadParts();
  }, [admin?.shop_id, partsQuery, vendorFilter, page, pageSize]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPartsQuery(partsSearch.trim());
      setPage(0);
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [partsSearch]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadAll = async () => {
    await loadLocations();
    await Promise.all([
      loadParts(),
      loadVendors(),
      loadPartLocations(),
      loadPurchaseOrders(),
      loadTransactions(),
    ]);
    await loadPartsNeeded();
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
    let query = supabase
      .from('parts')
      .select('*')
      .eq('shop_id', admin.shop_id)
      .eq('is_active', true);

    if (partsQuery) {
      query = query.or(
        `name.ilike.%${partsQuery}%,sku.ilike.%${partsQuery}%,vendor_sku.ilike.%${partsQuery}%`
      );
    }
    if (vendorFilter) {
      query = query.eq('vendor_id', vendorFilter);
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
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

  const loadPartsNeeded = async () => {
    if (!admin?.shop_id) return;
    try {
      const { data: orderRows, error: orderError } = await supabase
        .from('repair_orders')
        .select('*')
        .eq('shop_id', admin.shop_id)
        .neq('status', 'closed')
        .order('created_at', { ascending: false });
      if (orderError) throw orderError;
      const ordersList = (orderRows || []) as RepairOrder[];
      if (ordersList.length === 0) {
        setPartsNeeded([]);
        return;
      }
      const orderIds = ordersList.map((order) => order.id);
      const { data: reservationRows, error: reservationError } = await supabase
        .from('repair_order_part_reservations')
        .select('*')
        .in('repair_order_id', orderIds)
        .order('created_at', { ascending: false });
      if (reservationError) throw reservationError;
      const reservations = (reservationRows || []) as RepairOrderPartReservation[];
      if (reservations.length === 0) {
        setPartsNeeded([]);
        return;
      }
      const partIds = [...new Set(reservations.map((res) => res.part_id))];
      const vendorIds = [...new Set(reservations.map((res) => res.vendor_id).filter(Boolean) as string[])];
      const { data: partRows, error: partError } = await supabase
        .from('parts')
        .select('*')
        .in('id', partIds);
      if (partError) throw partError;
      const { data: vendorRows, error: vendorError } = vendorIds.length > 0
        ? await supabase.from('vendors').select('*').in('id', vendorIds)
        : { data: [], error: null };
      if (vendorError) throw vendorError;

      const partMap = new Map<string, Part>((partRows || []).map((part) => [part.id, part as Part]));
      const vendorMap = new Map<string, Vendor>((vendorRows || []).map((vendor) => [vendor.id, vendor as Vendor]));
      const orderMap = new Map<string, RepairOrder>(ordersList.map((order) => [order.id, order]));
      const locationMap = new Map<string, ShopLocation>(locations.map((loc) => [loc.id, loc]));

      const rows = reservations
        .map((reservation) => {
          const part = partMap.get(reservation.part_id);
          const order = orderMap.get(reservation.repair_order_id);
          if (!part || !order) return null;
          return {
            reservation,
            part,
            order,
            vendor: reservation.vendor_id ? vendorMap.get(reservation.vendor_id) || null : null,
            location: reservation.location_id ? locationMap.get(reservation.location_id) || null : null,
          } as PartsNeededRow;
        })
        .filter(Boolean) as PartsNeededRow[];
      setPartsNeeded(rows);
    } catch (error) {
      console.error('Failed to load parts needed:', error);
      setPartsNeeded([]);
    }
  };

  const updateReservationStatus = async (reservationId: string, jobStatus: string, extra: Partial<RepairOrderPartReservation> = {}) => {
    const { error } = await supabase
      .from('repair_order_part_reservations')
      .update({ job_status: jobStatus, updated_at: new Date().toISOString(), ...extra })
      .eq('id', reservationId);
    if (error) throw error;
    setPartsNeeded((prev) =>
      prev.map((row) => row.reservation.id === reservationId
        ? { ...row, reservation: { ...row.reservation, job_status: jobStatus, ...extra } }
        : row)
    );
  };

  const handleCreatePoFromNeeded = async () => {
    if (!admin?.shop_id) return;
    const selected = partsNeeded.filter((row) => selectedNeededIds[row.reservation.id]);
    if (selected.length === 0) {
      showMessage('error', 'Select parts to create a purchase order');
      return;
    }
    try {
      const groups = new Map<string, PartsNeededRow[]>();
      selected.forEach((row) => {
        const vendorId = row.reservation.vendor_id || row.part.vendor_id || null;
        const locationId = row.reservation.location_id || null;
        const key = `${vendorId || 'none'}|${locationId || 'none'}`;
        const list = groups.get(key) || [];
        list.push(row);
        groups.set(key, list);
      });

      for (const [, rows] of groups) {
        const vendorId = rows[0].reservation.vendor_id || rows[0].part.vendor_id || null;
        const locationId = rows[0].reservation.location_id || null;
        const { data: poRow, error: poError } = await supabase
          .from('purchase_orders')
          .insert({
            shop_id: admin.shop_id,
            vendor_id: vendorId,
            location_id: locationId,
            status: 'draft',
            notes: 'Created from Parts Needed',
          })
          .select('*')
          .single();
        if (poError) throw poError;
        const po = poRow as PurchaseOrder;

        const linesPayload = rows.map((row) => ({
          purchase_order_id: po.id,
          part_id: row.part.id,
          quantity: row.reservation.quantity,
          unit_cost: Number(row.part.unit_cost || 0),
          received_qty: 0,
          reservation_id: row.reservation.id,
        }));

        const { data: linesData, error: linesError } = await supabase
          .from('purchase_order_lines')
          .insert(linesPayload)
          .select('*');
        if (linesError) throw linesError;

        const lineMap = new Map<string, PurchaseOrderLine>();
        (linesData || []).forEach((line) => {
          if (line.reservation_id) lineMap.set(line.reservation_id, line as PurchaseOrderLine);
        });

        await Promise.all(
          rows.map(async (row) => {
            const line = lineMap.get(row.reservation.id);
            await updateReservationStatus(row.reservation.id, 'ordered', {
              po_line_id: line?.id || row.reservation.po_line_id,
              vendor_id: vendorId,
            });
          })
        );
      }

      setSelectedNeededIds({});
      await loadPurchaseOrders();
      showMessage('success', 'Purchase order created');
    } catch (error) {
      console.error('Failed to create PO from needed:', error);
      showMessage('error', 'Failed to create purchase order');
    }
  };

  const updatePartLocation = async (partId: string, locationId: string | null, delta: number) => {
    if (!locationId) return;
    const existing = partLocations.find((loc) => loc.part_id === partId && loc.location_id === locationId);
    if (!existing) {
      const { data, error } = await supabase
        .from('part_locations')
        .insert({
          part_id: partId,
          location_id: locationId,
          on_hand: Math.max(0, delta),
          reserved: 0,
          reorder_threshold: 0,
        })
        .select('*')
        .single();
      if (!error && data) {
        setPartLocations((prev) => [...prev, data as PartLocation]);
      }
      return;
    }
    const nextOnHand = Math.max(0, Number(existing.on_hand || 0) + delta);
    const { error } = await supabase
      .from('part_locations')
      .update({ on_hand: nextOnHand, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (!error) {
      setPartLocations((prev) =>
        prev.map((loc) => (loc.id === existing.id ? { ...loc, on_hand: nextOnHand } : loc))
      );
    }
  };

  const handleReceiveLine = async (po: PurchaseOrder, line: PurchaseOrderLine, quantity: number) => {
    if (!admin?.shop_id || !po.location_id) return;
    if (quantity <= 0) return;
    const nextReceived = Number(line.received_qty || 0) + quantity;
    const { error } = await supabase
      .from('purchase_order_lines')
      .update({ received_qty: nextReceived })
      .eq('id', line.id);
    if (error) throw error;

    await supabase.from('inventory_transactions').insert({
      shop_id: admin.shop_id,
      location_id: po.location_id,
      part_id: line.part_id,
      transaction_type: 'receive',
      quantity,
      reference_type: 'po',
      reference_id: po.id,
    });

    await updatePartLocation(line.part_id || '', po.location_id, quantity);

    if (line.reservation_id) {
      await updateReservationStatus(line.reservation_id, nextReceived >= line.quantity ? 'received' : 'partially_received', {
        po_line_id: line.id,
      });
    }

    setPurchaseLines((prev) =>
      prev.map((item) => (item.id === line.id ? { ...item, received_qty: nextReceived } : item))
    );

    const lines = purchaseLines.filter((item) => item.purchase_order_id === po.id);
    const allReceived = lines.every((item) =>
      (item.id === line.id ? nextReceived : item.received_qty) >= item.quantity
    );
    if (allReceived) {
      await supabase
        .from('purchase_orders')
        .update({ status: 'received', updated_at: new Date().toISOString() })
        .eq('id', po.id);
      setPurchaseOrders((prev) =>
        prev.map((item) => (item.id === po.id ? { ...item, status: 'received' } : item))
      );
    }
  };

  const handleReceiveAll = async () => {
    const po = purchaseOrders.find((item) => item.id === receivingPoId);
    if (!po) return;
    const lines = purchaseLines.filter((line) => line.purchase_order_id === po.id);
    try {
      for (const line of lines) {
        const remaining = Number(line.quantity) - Number(line.received_qty || 0);
        if (remaining > 0) {
          await handleReceiveLine(po, line, remaining);
        }
      }
      showMessage('success', 'Purchase order received');
    } catch (error) {
      console.error('Failed to receive PO:', error);
      showMessage('error', 'Failed to receive purchase order');
    }
  };

  const handleScanSubmit = async () => {
    const po = purchaseOrders.find((item) => item.id === receivingPoId);
    if (!po) return;
    const term = scanInput.trim().toLowerCase();
    if (!term) return;
    const partMatch = parts.find((part) =>
      [part.sku, part.vendor_sku, part.name].filter(Boolean).some((value) =>
        String(value).toLowerCase() === term || String(value).toLowerCase().includes(term)
      )
    );
    if (!partMatch) {
      showMessage('error', 'No matching part found');
      return;
    }
    const line = purchaseLines.find((item) => item.purchase_order_id === po.id && item.part_id === partMatch.id);
    if (!line) {
      showMessage('error', 'Part not on this purchase order');
      return;
    }
    const remaining = Number(line.quantity) - Number(line.received_qty || 0);
    if (remaining <= 0) {
      showMessage('error', 'Already fully received');
      return;
    }
    await handleReceiveLine(po, line, 1);
    setScanInput('');
  };

  const handleCreatePart = async () => {
    if (!admin?.shop_id || !newPart.name.trim()) {
      showMessage('error', 'Part name is required');
      return;
    }
    try {
      const { error } = await supabase.from('parts').insert({
        shop_id: admin.shop_id,
        name: newPart.name.trim(),
        sku: newPart.sku || null,
        vendor_id: newPart.vendor_id || null,
        vendor_sku: newPart.vendor_sku || null,
        category: newPart.category || null,
        unit_cost: Number(newPart.unit_cost || 0),
        unit_price: Number(newPart.unit_price || 0),
        taxable: Boolean(newPart.taxable),
      });
      if (error) throw error;
      showMessage('success', 'Part created');
      setNewPart({
        name: '',
        sku: '',
        vendor_id: '',
        vendor_sku: '',
        category: '',
        unit_cost: 0,
        unit_price: 0,
        taxable: true,
      });
      setShowNewPartModal(false);
      loadParts();
    } catch (error) {
      console.error('Failed to create part:', error);
      showMessage('error', 'Failed to create part');
    }
  };

  const handleCreateVendor = async () => {
    if (!admin?.shop_id || !newVendor.name.trim()) {
      showMessage('error', 'Vendor name is required');
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
      setShowNewVendorModal(false);
      loadVendors();
    } catch (error) {
      console.error('Failed to create vendor:', error);
      showMessage('error', 'Failed to create vendor');
    }
  };

  const handleAdjustStock = async () => {
    if (!admin?.shop_id) return;
    const adjustmentQty = Number(stockAdjustment.quantity);
    if (!stockAdjustment.part_id || !stockAdjustment.location_id || !Number.isFinite(adjustmentQty) || adjustmentQty === 0) {
      showMessage('error', 'Select part, location, and quantity');
      return;
    }
    try {
      const { error } = await supabase.from('inventory_transactions').insert({
        shop_id: admin.shop_id,
        location_id: stockAdjustment.location_id,
        part_id: stockAdjustment.part_id,
        transaction_type: 'adjust',
        quantity: adjustmentQty,
        reference_type: 'adjustment',
      });
      if (error) throw error;
      await logAuditEvent({
        shopId: admin.shop_id,
        actorRole: 'admin',
        eventType: 'inventory_adjustment',
        entityType: 'part',
        entityId: stockAdjustment.part_id,
        metadata: { quantity: adjustmentQty, location_id: stockAdjustment.location_id },
      });
      await updatePartLocation(stockAdjustment.part_id, stockAdjustment.location_id, adjustmentQty);
      showMessage('success', 'Stock adjusted');
      setStockAdjustment({ part_id: '', location_id: '', quantity: '' });
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
      showMessage('error', 'Add at least one part');
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
      setShowNewPOModal(false);
      showMessage('success', 'Purchase order created');
      loadPurchaseOrders();
    } catch (error) {
      console.error('Failed to create PO:', error);
      showMessage('error', 'Failed to create purchase order');
    }
  };

  const openPartDrawer = (part: Part) => {
    setSelectedPartId(part.id);
    setEditPartDraft({
      name: part.name,
      sku: part.sku || '',
      vendor_id: part.vendor_id || '',
      vendor_sku: part.vendor_sku || '',
      category: part.category || '',
      unit_cost: part.unit_cost,
      unit_price: part.unit_price,
      taxable: part.taxable,
    });
    const preferredLocationId = locationFilter || locations[0]?.id || '';
    const locationRow = partLocations.find((loc) => loc.part_id === part.id && loc.location_id === preferredLocationId)
      || partLocations.find((loc) => loc.part_id === part.id)
      || null;
    setEditLocationDraft(locationRow || { location_id: preferredLocationId, part_id: part.id, on_hand: 0, reserved: 0, reorder_min: 0, reorder_max: 0, bin: '' });
  };

  const closePartDrawer = () => {
    setSelectedPartId(null);
    setEditPartDraft({});
    setEditLocationDraft({});
  };

  const savePartEdits = async () => {
    if (!selectedPartId) return;
    try {
      const { error: partError } = await supabase
        .from('parts')
        .update({
          name: editPartDraft.name,
          sku: editPartDraft.sku || null,
          vendor_id: editPartDraft.vendor_id || null,
          vendor_sku: editPartDraft.vendor_sku || null,
          category: editPartDraft.category || null,
          unit_cost: Number(editPartDraft.unit_cost || 0),
          unit_price: Number(editPartDraft.unit_price || 0),
          taxable: Boolean(editPartDraft.taxable),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPartId);
      if (partError) {
        console.error('Part update error:', partError);
        throw partError;
      }

      if (editLocationDraft.location_id) {
        const existing = partLocations.find((loc) => loc.part_id === selectedPartId && loc.location_id === editLocationDraft.location_id);
        if (existing) {
          const { error: locationError } = await supabase
            .from('part_locations')
            .update({
              on_hand: Number(editLocationDraft.on_hand || 0),
              reserved: Number(editLocationDraft.reserved || 0),
              reorder_min: Number(editLocationDraft.reorder_min || 0),
              reorder_max: Number(editLocationDraft.reorder_max || 0),
              bin: editLocationDraft.bin || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          if (locationError) {
            console.error('Location update error:', locationError);
            throw locationError;
          }
        } else {
          const { error: insertError } = await supabase
            .from('part_locations')
            .insert({
              part_id: selectedPartId,
              location_id: editLocationDraft.location_id,
              on_hand: Number(editLocationDraft.on_hand || 0),
              reserved: Number(editLocationDraft.reserved || 0),
              reorder_min: Number(editLocationDraft.reorder_min || 0),
              reorder_max: Number(editLocationDraft.reorder_max || 0),
              bin: editLocationDraft.bin || null,
              reorder_threshold: 0,
            });
          if (insertError) {
            console.error('Location insert error:', insertError);
            throw insertError;
          }
        }
      }

      showMessage('success', 'Part updated');
      await loadParts();
      await loadPartLocations();
      closePartDrawer();
    } catch (error: any) {
      console.error('Failed to update part:', error);
      showMessage('error', `Failed to update part: ${error?.message || 'Unknown error'}`);
    }
  };

  const lowStockParts = useMemo(() => {
    return partLocations.filter((loc) => {
      const min = Number(loc.reorder_min || loc.reorder_threshold || 0);
      return Number(loc.on_hand || 0) <= min;
    });
  }, [partLocations]);

  const partLocationSummary = useMemo(() => {
    const summary = new Map<string, { onHand: number; reserved: number; reorderMin: number; reorderMax: number; bin?: string | null }>();
    partLocations.forEach((loc) => {
      if (locationFilter && loc.location_id !== locationFilter) return;
      const current = summary.get(loc.part_id) || { onHand: 0, reserved: 0, reorderMin: loc.reorder_min || 0, reorderMax: loc.reorder_max || 0, bin: loc.bin || null };
      summary.set(loc.part_id, {
        onHand: current.onHand + Number(loc.on_hand || 0),
        reserved: current.reserved + Number(loc.reserved || 0),
        reorderMin: Math.max(current.reorderMin, Number(loc.reorder_min || 0)),
        reorderMax: Math.max(current.reorderMax, Number(loc.reorder_max || 0)),
        bin: current.bin || loc.bin || null,
      });
    });
    return summary;
  }, [partLocations, locationFilter]);

  const filteredParts = useMemo(() => {
    if (stockFilter === 'all') return parts;
    return parts.filter((part) => {
      const summary = partLocationSummary.get(part.id);
      const onHand = summary?.onHand || 0;
      const reorderMin = summary?.reorderMin || 0;
      if (stockFilter === 'in') return onHand > 0;
      if (stockFilter === 'out') return onHand <= 0;
      if (stockFilter === 'low') return onHand <= reorderMin;
      return true;
    });
  }, [parts, partLocationSummary, stockFilter]);

  const pendingPOs = purchaseOrders.filter((po) => po.status !== 'received' && po.status !== 'closed');
  const needsOrderingCount = partsNeeded.filter((row) => row.reservation.job_status === 'needed').length;

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
          <h2 className="text-2xl font-bold text-slate-900">Inventory Management</h2>
          <p className="text-slate-600">Manage parts, vendors, and purchase orders</p>
        </div>
        {locations.length === 0 && (
          <button
            onClick={ensureDefaultLocation}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
          >
            Create Main Location
          </button>
        )}
      </div>

      {mainView === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: `${brandSettings.primary_color}15` }}>
                    <Boxes className="w-6 h-6" style={{ color: brandSettings.primary_color }} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Parts</p>
                    <p className="text-2xl font-bold text-slate-900">{parts.length}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMainView('parts')}
                className="w-full py-2 px-4 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                View Parts <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-orange-50">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Parts Needed</p>
                    <p className="text-2xl font-bold text-slate-900">{needsOrderingCount}</p>
                  </div>
                </div>
              </div>
              {needsOrderingCount > 0 && (
                <button
                  onClick={() => setMainView('orders')}
                  className="w-full py-2 px-4 text-white rounded-lg text-sm flex items-center justify-center gap-2"
                  style={{ backgroundColor: brandSettings.primary_color }}
                >
                  Create Order <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-50">
                    <ShoppingCart className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Active Orders</p>
                    <p className="text-2xl font-bold text-slate-900">{pendingPOs.length}</p>
                  </div>
                </div>
              </div>
              {pendingPOs.length > 0 && (
                <button
                  onClick={() => setMainView('receiving')}
                  className="w-full py-2 px-4 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  Receive Items <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {lowStockParts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-semibold">Low Stock Alert</h3>
              </div>
              <p className="text-sm text-yellow-700 mb-3">
                {lowStockParts.length} part(s) are at or below reorder threshold
              </p>
              <button
                onClick={() => setMainView('parts')}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700"
              >
                Review Parts
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setShowNewPartModal(true)}
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-3"
              >
                <Plus className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium">Add New Part</span>
              </button>
              <button
                onClick={() => setShowNewPOModal(true)}
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-3"
              >
                <ShoppingCart className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium">Create Purchase Order</span>
              </button>
              <button
                onClick={() => setShowNewVendorModal(true)}
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-3"
              >
                <Truck className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium">Add Vendor</span>
              </button>
            </div>
          </div>

          {transactions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
              <h3 className="font-semibold text-slate-900">Recent Activity</h3>
              <div className="space-y-2">
                {transactions.slice(0, 5).map((tx) => {
                  const part = parts.find((p) => p.id === tx.part_id);
                  return (
                    <div key={tx.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
                      <div>
                        <p className="font-medium text-slate-900 capitalize">{tx.transaction_type}</p>
                        <p className="text-xs text-slate-500">{part?.name || 'Unknown part'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{tx.quantity > 0 ? '+' : ''}{tx.quantity}</p>
                        <p className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {mainView === 'parts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMainView('overview')}
              className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              ← Back to Overview
            </button>
            <button
              onClick={() => setShowNewPartModal(true)}
              className="px-4 py-2 text-white rounded-lg text-sm flex items-center gap-2"
              style={{ backgroundColor: brandSettings.primary_color }}
            >
              <Plus className="w-4 h-4" />
              Add Part
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  value={partsSearch}
                  onChange={(e) => setPartsSearch(e.target.value)}
                  placeholder="Search parts by name or SKU"
                  className="bg-transparent outline-none text-sm w-full"
                />
              </div>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">All vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="all">All stock</option>
                <option value="in">In stock</option>
                <option value="out">Out of stock</option>
                <option value="low">Low stock</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Parts Catalog</h3>
              <div className="text-xs text-slate-500">{filteredParts.length} parts</div>
            </div>
            <div className="space-y-2">
              {filteredParts.map((part) => {
                const summary = partLocationSummary.get(part.id);
                const isLowStock = (summary?.onHand || 0) <= (summary?.reorderMin || 0);
                return (
                  <div key={part.id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{part.name}</p>
                          {isLowStock && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">Low</span>}
                        </div>
                        <p className="text-xs text-slate-500">{part.sku || 'No SKU'} • {part.category || 'Uncategorized'}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="text-slate-500">Stock: </span>
                          <span className="font-semibold text-slate-900">{summary?.onHand ?? 0}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-500">Price: </span>
                          <span className="font-semibold text-slate-900">${Number(part.unit_price || 0).toFixed(2)}</span>
                        </div>
                        <button
                          onClick={() => openPartDrawer(part)}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-white flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredParts.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No parts found</p>}
            </div>
            {filteredParts.length >= pageSize && (
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
                  disabled={page === 0}
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">Page {page + 1}</span>
                <button
                  onClick={() => setPage((prev) => prev + 1)}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
                  disabled={filteredParts.length < pageSize}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">Stock Adjustment</h3>
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
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Quantity (+/-)"
              />
              <button
                onClick={handleAdjustStock}
                className="px-4 py-2 text-white rounded-lg text-sm"
                style={{ backgroundColor: brandSettings.primary_color }}
              >
                Adjust Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {mainView === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMainView('overview')}
              className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              ← Back to Overview
            </button>
            <button
              onClick={() => setShowNewPOModal(true)}
              className="px-4 py-2 text-white rounded-lg text-sm flex items-center gap-2"
              style={{ backgroundColor: brandSettings.primary_color }}
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </button>
          </div>

          {needsOrderingCount > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Parts Needed for Jobs</h3>
                  <p className="text-xs text-slate-500">{needsOrderingCount} parts waiting to be ordered</p>
                </div>
                <button
                  onClick={handleCreatePoFromNeeded}
                  disabled={Object.keys(selectedNeededIds).length === 0}
                  className="px-4 py-2 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: brandSettings.primary_color }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Create Order
                </button>
              </div>
              <div className="space-y-2">
                {partsNeeded.filter((row) => row.reservation.job_status === 'needed').map((row) => (
                  <div key={row.reservation.id} className="border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedNeededIds[row.reservation.id])}
                      onChange={(e) =>
                        setSelectedNeededIds((prev) => ({ ...prev, [row.reservation.id]: e.target.checked }))
                      }
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{row.part.name}</p>
                      <p className="text-xs text-slate-500">
                        RO {row.order.ro_number} • Qty: {row.reservation.quantity} • {row.vendor?.name || 'No vendor'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">All Purchase Orders</h3>
            <div className="space-y-2">
              {purchaseOrders.map((po) => {
                const vendor = vendors.find((v) => v.id === po.vendor_id);
                const lines = purchaseLines.filter((line) => line.purchase_order_id === po.id);
                const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
                const receivedItems = lines.reduce((sum, line) => sum + (line.received_qty || 0), 0);
                return (
                  <div key={po.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-slate-900">{po.po_number || `PO-${po.id.slice(0, 8)}`}</p>
                        <p className="text-xs text-slate-500">{vendor?.name || 'No vendor'} • {po.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {po.status !== 'received' && po.status !== 'closed' && (
                          <button
                            onClick={() => {
                              setReceivingPoId(po.id);
                              setMainView('receiving');
                            }}
                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                          >
                            Receive
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">
                      {lines.length} line items • {receivedItems}/{totalItems} received
                    </div>
                  </div>
                );
              })}
              {purchaseOrders.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No purchase orders yet</p>}
            </div>
          </div>
        </div>
      )}

      {mainView === 'receiving' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMainView('overview')}
              className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              ← Back to Overview
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Receive Purchase Order</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={receivingPoId}
                onChange={(e) => setReceivingPoId(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select purchase order</option>
                {pendingPOs.map((po) => {
                  const vendor = vendors.find((v) => v.id === po.vendor_id);
                  return (
                    <option key={po.id} value={po.id}>
                      {po.po_number || `PO-${po.id.slice(0, 8)}`} - {vendor?.name || 'No vendor'}
                    </option>
                  );
                })}
              </select>
              <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Scan part SKU"
                  className="outline-none text-sm w-full"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleScanSubmit();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleReceiveAll}
                className="px-4 py-2 text-white rounded-lg text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: brandSettings.primary_color }}
                disabled={!receivingPoId}
              >
                <CheckCircle className="w-4 h-4" />
                Receive All
              </button>
            </div>
          </div>

          {receivingPoId && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="font-semibold text-slate-900">Items to Receive</h3>
              <div className="space-y-2">
                {purchaseLines
                  .filter((line) => line.purchase_order_id === receivingPoId)
                  .map((line) => {
                    const part = parts.find((p) => p.id === line.part_id);
                    const remaining = Number(line.quantity) - Number(line.received_qty || 0);
                    const po = purchaseOrders.find((item) => item.id === receivingPoId);
                    return (
                      <div key={line.id} className="border border-slate-200 rounded-lg p-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{part?.name || 'Part'}</p>
                            <p className="text-xs text-slate-500">SKU: {part?.sku || '—'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-sm">
                              <span className="text-slate-500">Ordered: </span>
                              <span className="font-semibold">{line.quantity}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-slate-500">Received: </span>
                              <span className="font-semibold">{line.received_qty || 0}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-slate-500">Remaining: </span>
                              <span className="font-semibold">{remaining}</span>
                            </div>
                            <button
                              onClick={() => {
                                if (!po) return;
                                handleReceiveLine(po, line, Math.min(1, remaining));
                              }}
                              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50"
                              disabled={remaining <= 0}
                            >
                              +1
                            </button>
                            <button
                              onClick={() => {
                                if (!po) return;
                                handleReceiveLine(po, line, remaining);
                              }}
                              className="px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
                              style={{ backgroundColor: brandSettings.primary_color }}
                              disabled={remaining <= 0}
                            >
                              All
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedPartId && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={closePartDrawer}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Edit Part</h3>
              <button onClick={closePartDrawer} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Part Information Section */}
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Part Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Part Name *</label>
                    <input
                      value={editPartDraft.name || ''}
                      onChange={(e) => setEditPartDraft((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Oil Filter"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                    <input
                      value={editPartDraft.category || ''}
                      onChange={(e) => setEditPartDraft((prev) => ({ ...prev, category: e.target.value }))}
                      placeholder="e.g., Filters, Brakes"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Your SKU</label>
                    <input
                      value={editPartDraft.sku || ''}
                      onChange={(e) => setEditPartDraft((prev) => ({ ...prev, sku: e.target.value }))}
                      placeholder="Your internal part number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Vendor SKU</label>
                    <input
                      value={editPartDraft.vendor_sku || ''}
                      onChange={(e) => setEditPartDraft((prev) => ({ ...prev, vendor_sku: e.target.value }))}
                      placeholder="Manufacturer part number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Pricing</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Your Cost <span className="text-slate-500">(what you pay)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={Number(editPartDraft.unit_cost || 0)}
                        onChange={(e) => setEditPartDraft((prev) => ({ ...prev, unit_cost: Number(e.target.value) }))}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Sell Price <span className="text-slate-500">(what you charge)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={Number(editPartDraft.unit_price || 0)}
                        onChange={(e) => setEditPartDraft((prev) => ({ ...prev, unit_price: Number(e.target.value) }))}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Vendor</label>
                    <select
                      value={editPartDraft.vendor_id || ''}
                      onChange={(e) => setEditPartDraft((prev) => ({ ...prev, vendor_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Select vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Inventory Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Inventory</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                    <select
                      value={editLocationDraft.location_id || ''}
                      onChange={(e) => setEditLocationDraft((prev) => ({ ...prev, location_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Select location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Bin Location <span className="text-slate-500">(shelf/bin number)</span>
                    </label>
                    <input
                      value={editLocationDraft.bin || ''}
                      onChange={(e) => setEditLocationDraft((prev) => ({ ...prev, bin: e.target.value }))}
                      placeholder="e.g., A-12, Shelf 3"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Qty On Hand <span className="text-slate-500">(available now)</span>
                    </label>
                    <input
                      type="number"
                      value={Number(editLocationDraft.on_hand || 0)}
                      onChange={(e) => setEditLocationDraft((prev) => ({ ...prev, on_hand: Number(e.target.value) }))}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Reorder Point <span className="text-slate-500">(auto-alert when below)</span>
                    </label>
                    <input
                      type="number"
                      value={Number(editLocationDraft.reorder_min || 0)}
                      onChange={(e) => setEditLocationDraft((prev) => ({ ...prev, reorder_min: Number(e.target.value) }))}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closePartDrawer} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={savePartEdits}
                className="px-4 py-2 text-white rounded-lg text-sm"
                style={{ backgroundColor: brandSettings.primary_color }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewPartModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowNewPartModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Add New Part</h3>
              <button onClick={() => setShowNewPartModal(false)} className="text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Part Name *</label>
                <input
                  value={newPart.name}
                  onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                  placeholder="e.g., Oil Filter, Brake Pads"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Your SKU</label>
                  <input
                    value={newPart.sku}
                    onChange={(e) => setNewPart({ ...newPart, sku: e.target.value })}
                    placeholder="e.g., OF-123"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Vendor SKU</label>
                  <input
                    value={newPart.vendor_sku}
                    onChange={(e) => setNewPart({ ...newPart, vendor_sku: e.target.value })}
                    placeholder="e.g., WIX-51515"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Your Cost (what you pay)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newPart.unit_cost}
                      onChange={(e) => setNewPart({ ...newPart, unit_cost: Number(e.target.value) })}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sell Price (what you charge)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newPart.unit_price}
                      onChange={(e) => setNewPart({ ...newPart, unit_price: Number(e.target.value) })}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vendor</label>
                <select
                  value={newPart.vendor_id}
                  onChange={(e) => setNewPart({ ...newPart, vendor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <input
                  value={newPart.category}
                  onChange={(e) => setNewPart({ ...newPart, category: e.target.value })}
                  placeholder="e.g., Filters, Brakes, Fluids"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewPartModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={handleCreatePart}
                className="px-4 py-2 text-white rounded-lg text-sm"
                style={{ backgroundColor: brandSettings.primary_color }}
              >
                Add Part
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewVendorModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowNewVendorModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Add New Vendor</h3>
              <button onClick={() => setShowNewVendorModal(false)} className="text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={newVendor.name}
                onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                placeholder="Vendor name *"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                value={newVendor.phone}
                onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                placeholder="Phone"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                value={newVendor.email}
                onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                placeholder="Email"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                value={newVendor.address}
                onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                placeholder="Address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewVendorModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={handleCreateVendor}
                className="px-4 py-2 text-white rounded-lg text-sm"
                style={{ backgroundColor: brandSettings.primary_color }}
              >
                Add Vendor
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewPOModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowNewPOModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Create Purchase Order</h3>
              <button onClick={() => setShowNewPOModal(false)} className="text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={poDraft.vendor_id}
                onChange={(e) => setPoDraft({ ...poDraft, vendor_id: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select vendor *</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
              <select
                value={poDraft.location_id}
                onChange={(e) => setPoDraft({ ...poDraft, location_id: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select location *</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <textarea
              value={poDraft.notes}
              onChange={(e) => setPoDraft({ ...poDraft, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              rows={2}
            />
            <div className="space-y-2">
              <h4 className="font-medium text-slate-900 text-sm">Line Items</h4>
              {poLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <select
                    value={line.part_id}
                    onChange={(e) => {
                      const next = [...poLines];
                      const part = parts.find((p) => p.id === e.target.value);
                      next[idx] = { ...line, part_id: e.target.value, unit_cost: part?.unit_cost || 0 };
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
                    placeholder="Cost"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => setPoLines(poLines.filter((_, lineIdx) => lineIdx !== idx))}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => setPoLines([...poLines, { part_id: '', quantity: 1, unit_cost: 0 }])}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Line
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewPOModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={handleCreatePurchaseOrder}
                className="px-4 py-2 text-white rounded-lg text-sm"
                style={{ backgroundColor: brandSettings.primary_color }}
              >
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
