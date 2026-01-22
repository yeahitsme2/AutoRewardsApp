import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useShop } from '../lib/ShopContext';
import { FileText, Upload, X, Calendar, DollarSign, Wrench, Trash2, Download, Eye, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import type { RepairOrder, Customer, Vehicle } from '../types/database';

interface RepairOrderWithDetails extends RepairOrder {
  customer: Customer | null;
  vehicle?: Vehicle | null;
}

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  selectedCustomerId?: string;
  selectedVehicleId?: string;
  serviceDate: string;
  totalAmount: string;
  partsCost: string;
  laborCost: string;
  serviceWriter: string;
  error?: string;
  fileUrl?: string;
}

interface SplitResult {
  file_url: string;
}

export function RepairOrdersManagement() {
  const { customer } = useAuth();
  const { shop } = useShop();
  const [repairOrders, setRepairOrders] = useState<RepairOrderWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [splitMultiPagePDFs, setSplitMultiPagePDFs] = useState(true);

  useEffect(() => {
    loadRepairOrders();
    loadCustomers();
    loadAllVehicles();
  }, []);

  const loadRepairOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('repair_orders')
        .select('*, customer:customers(*), vehicle:vehicles(*)')
        .order('service_date', { ascending: false });

      if (error) throw error;
      setRepairOrders(data || []);
    } catch (error) {
      console.error('Error loading repair orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadAllVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('year', { ascending: false });

      if (error) throw error;
      setAllVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
      alert('Please select PDF files only');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    if (splitMultiPagePDFs) {
      setProcessing(true);

      for (const file of pdfFiles) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('shop_id', shop?.id || '');

          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/split-repair-order-pdf`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: formData
          });

          if (!response.ok) {
            throw new Error('Failed to split PDF');
          }

          const result = await response.json();

          if (result.success && result.results) {
            const newItems: UploadItem[] = result.results.map((item: SplitResult, index: number) => ({
              file: new File([], `${file.name.replace('.pdf', '')}_page_${index + 1}.pdf`, { type: 'application/pdf' }),
              status: 'pending',
              fileUrl: item.file_url,
              selectedCustomerId: '',
              selectedVehicleId: '',
              serviceDate: today,
              totalAmount: '0',
              partsCost: '0',
              laborCost: '0',
              serviceWriter: ''
            }));

            setUploadItems(prev => [...prev, ...newItems]);
          }
        } catch (error: any) {
          console.error('Error splitting PDF:', error);
          const newItems: UploadItem[] = [{
            file,
            status: 'error',
            error: 'Failed to split PDF. Try uploading without split option.',
            serviceDate: today,
            totalAmount: '0',
            partsCost: '0',
            laborCost: '0',
            serviceWriter: ''
          }];
          setUploadItems(prev => [...prev, ...newItems]);
        }
      }

      setProcessing(false);
    } else {
      const newItems: UploadItem[] = pdfFiles.map(file => ({
        file,
        status: 'pending',
        serviceDate: today,
        totalAmount: '0',
        partsCost: '0',
        laborCost: '0',
        serviceWriter: ''
      }));

      setUploadItems(prev => [...prev, ...newItems]);
    }
  };

  const uploadAll = async () => {
    setProcessing(true);

    for (let i = 0; i < uploadItems.length; i++) {
      const item = uploadItems[i];

      if (item.status === 'complete' || item.status === 'error') continue;

      setUploadItems(prev => prev.map((itm, idx) =>
        idx === i ? { ...itm, status: 'uploading' } : itm
      ));

      try {
        let fileUrl = item.fileUrl;

        if (!fileUrl) {
          const fileExt = 'pdf';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${shop?.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('repair-orders')
            .upload(filePath, item.file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('repair-orders')
            .getPublicUrl(filePath);

          fileUrl = urlData.publicUrl;
        }

        const totalAmount = parseFloat(item.totalAmount) || 0;
        const partsCost = parseFloat(item.partsCost) || 0;
        const laborCost = parseFloat(item.laborCost) || 0;

        const { error: insertError } = await supabase.from('repair_orders').insert({
          shop_id: shop?.id!,
          customer_id: item.selectedCustomerId || null,
          vehicle_id: item.selectedVehicleId || null,
          service_date: item.serviceDate,
          file_url: fileUrl,
          total_amount: totalAmount,
          parts_cost: partsCost,
          labor_cost: laborCost,
          service_writer: item.serviceWriter || '',
          notes: '',
          is_matched: !!item.selectedCustomerId,
        });

        if (insertError) throw insertError;

        setUploadItems(prev => prev.map((itm, idx) =>
          idx === i ? { ...itm, status: 'complete' } : itm
        ));

      } catch (error: any) {
        console.error('Error uploading repair order:', error);
        setUploadItems(prev => prev.map((itm, idx) =>
          idx === i ? {
            ...itm,
            status: 'error',
            error: error.message || 'Failed to upload'
          } : itm
        ));
      }
    }

    setProcessing(false);

    const allComplete = uploadItems.every(item => item.status === 'complete');
    if (allComplete) {
      alert('All repair orders uploaded successfully!');
      setShowUploadModal(false);
      setUploadItems([]);
      setSplitMultiPagePDFs(true);
      loadRepairOrders();
    }
  };

  const handleDelete = async (order: RepairOrder) => {
    if (!confirm('Are you sure you want to delete this repair order? This action cannot be undone.')) {
      return;
    }

    try {
      const fileName = order.file_url.split('/').pop();
      if (fileName) {
        const filePath = `${order.shop_id}/${fileName}`;
        await supabase.storage.from('repair-orders').remove([filePath]);
      }

      const { error } = await supabase
        .from('repair_orders')
        .delete()
        .eq('id', order.id);

      if (error) throw error;

      alert('Repair order deleted successfully');
      loadRepairOrders();
    } catch (error: any) {
      console.error('Error deleting repair order:', error);
      alert('Failed to delete repair order: ' + (error?.message || 'Unknown error'));
    }
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

  const handleView = async (order: RepairOrder) => {
    window.open(order.file_url, '_blank');
  };

  const removeUploadItem = (index: number) => {
    setUploadItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateItem = (index: number, updates: Partial<UploadItem>) => {
    setUploadItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const newItem = { ...item, ...updates };
        if (updates.selectedCustomerId !== undefined && updates.selectedCustomerId) {
          const customerVehicles = allVehicles.filter(v => v.customer_id === updates.selectedCustomerId);
          if (customerVehicles.length > 0 && !newItem.selectedVehicleId) {
            newItem.selectedVehicleId = customerVehicles[0].id;
          }
        }
        return newItem;
      }
      return item;
    }));
  };

  if (loading) {
    return <div className="text-slate-600">Loading repair orders...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Repair Orders</h2>
          <p className="text-slate-600">Upload and manage customer repair order documents</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Upload className="w-5 h-5" />
          Batch Upload
        </button>
      </div>

      {repairOrders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Repair Orders Yet</h3>
          <p className="text-slate-600 mb-4">Upload your first repair order to get started</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Upload className="w-5 h-5" />
            Batch Upload
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {repairOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        {order.customer?.full_name || 'No Customer Assigned'}
                      </h3>
                      <span className="text-sm text-slate-500">|</span>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Calendar className="w-4 h-4" />
                        {new Date(order.service_date).toLocaleDateString()}
                      </div>
                    </div>
                    {order.vehicle && (
                      <p className="text-slate-600 mb-2">
                        {order.vehicle.year} {order.vehicle.make} {order.vehicle.model}
                      </p>
                    )}
                    {order.notes && (
                      <p className="text-sm text-slate-500 mb-2">{order.notes}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-slate-700">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold">Total: ${order.total_amount.toFixed(2)}</span>
                      </div>
                      {order.parts_cost > 0 && (
                        <span className="text-slate-600">Parts: ${order.parts_cost.toFixed(2)}</span>
                      )}
                      {order.labor_cost > 0 && (
                        <span className="text-slate-600">Labor: ${order.labor_cost.toFixed(2)}</span>
                      )}
                    </div>
                    {order.service_writer && (
                      <div className="flex items-center gap-1 text-sm text-slate-600 mt-2">
                        <Wrench className="w-4 h-4" />
                        Service Writer: {order.service_writer}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <button
                  onClick={() => handleView(order)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => handleDownload(order)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => handleDelete(order)}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Batch Upload Repair Orders</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadItems([]);
                  setSplitMultiPagePDFs(true);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <label className="cursor-pointer">
                  <span className="text-blue-500 hover:text-blue-600 font-medium">
                    Choose PDF files
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFilesSelect}
                    className="hidden"
                    disabled={processing}
                  />
                </label>
                <p className="text-sm text-slate-500 mt-2">
                  Upload multiple repair orders at once
                </p>

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <label className="flex items-center justify-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={splitMultiPagePDFs}
                      onChange={(e) => setSplitMultiPagePDFs(e.target.checked)}
                      disabled={processing || uploadItems.length > 0}
                      className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Automatically split multi-page PDFs into individual repair orders
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 mt-2">
                    Enable this if your PDF contains multiple repair orders scanned together
                  </p>
                </div>
              </div>

              {uploadItems.length > 0 && (
                <>
                  <div className="space-y-3">
                    {uploadItems.map((item, index) => (
                      <div key={index} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {item.status === 'complete' && <CheckCircle className="w-5 h-5 text-green-500" />}
                            {item.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            {item.status === 'uploading' && <Loader className="w-5 h-5 text-blue-500 animate-spin" />}
                            {item.status === 'pending' && <FileText className="w-5 h-5 text-slate-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-medium text-slate-900 truncate">{item.file.name}</p>
                              <button
                                onClick={() => removeUploadItem(index)}
                                className="text-slate-400 hover:text-red-500 ml-2"
                                disabled={processing}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {item.status === 'uploading' && (
                              <p className="text-sm text-blue-600">Uploading...</p>
                            )}

                            {item.status === 'error' && (
                              <p className="text-sm text-red-600">{item.error}</p>
                            )}

                            {item.status === 'complete' && (
                              <p className="text-sm text-green-600">Uploaded successfully</p>
                            )}

                            {item.status === 'pending' && (
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Customer
                                  </label>
                                  <select
                                    value={item.selectedCustomerId || ''}
                                    onChange={(e) => updateItem(index, { selectedCustomerId: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    disabled={processing}
                                  >
                                    <option value="">No customer</option>
                                    {customers.map(c => (
                                      <option key={c.id} value={c.id}>
                                        {c.full_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Vehicle (Optional)
                                  </label>
                                  <select
                                    value={item.selectedVehicleId || ''}
                                    onChange={(e) => updateItem(index, { selectedVehicleId: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    disabled={processing || !item.selectedCustomerId}
                                  >
                                    <option value="">No vehicle</option>
                                    {allVehicles
                                      .filter(v => v.customer_id === item.selectedCustomerId)
                                      .map(v => (
                                        <option key={v.id} value={v.id}>
                                          {v.year} {v.make} {v.model}
                                        </option>
                                      ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Service Date
                                  </label>
                                  <input
                                    type="date"
                                    value={item.serviceDate}
                                    onChange={(e) => updateItem(index, { serviceDate: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    disabled={processing}
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Total Amount ($)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.totalAmount}
                                    onChange={(e) => updateItem(index, { totalAmount: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    disabled={processing}
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Parts Cost ($)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.partsCost}
                                    onChange={(e) => updateItem(index, { partsCost: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    disabled={processing}
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Labor Cost ($)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.laborCost}
                                    onChange={(e) => updateItem(index, { laborCost: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    disabled={processing}
                                  />
                                </div>

                                <div className="col-span-3">
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Service Writer (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={item.serviceWriter}
                                    onChange={(e) => updateItem(index, { serviceWriter: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    disabled={processing}
                                    placeholder="Enter service writer name"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button
                      onClick={uploadAll}
                      disabled={processing || uploadItems.length === 0}
                      className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      {processing ? 'Uploading...' : `Upload All (${uploadItems.length})`}
                    </button>

                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadItems([]);
                        setSplitMultiPagePDFs(true);
                      }}
                      disabled={processing}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
