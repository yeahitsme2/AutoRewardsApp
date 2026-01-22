import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useShop } from '../lib/ShopContext';
import { FileText, Upload, X, Plus, Calendar, DollarSign, Wrench, Trash2, Download, Eye } from 'lucide-react';
import type { RepairOrder, Customer, Vehicle } from '../types/database';

interface RepairOrderWithDetails extends RepairOrder {
  customer: Customer;
  vehicle?: Vehicle | null;
}

export function RepairOrdersManagement() {
  const { customer } = useAuth();
  const { shop } = useShop();
  const [repairOrders, setRepairOrders] = useState<RepairOrderWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    service_date: new Date().toISOString().split('T')[0],
    total_amount: '',
    parts_cost: '',
    labor_cost: '',
    service_writer: '',
    notes: '',
  });

  useEffect(() => {
    loadRepairOrders();
    loadCustomers();
  }, []);

  useEffect(() => {
    if (formData.customer_id) {
      loadCustomerVehicles(formData.customer_id);
    } else {
      setVehicles([]);
    }
  }, [formData.customer_id]);

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

  const loadCustomerVehicles = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('customer_id', customerId)
        .order('year', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      alert('Please select a PDF file');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile || !shop?.id) {
      alert('Please select a file and ensure shop is loaded');
      return;
    }

    if (!formData.customer_id) {
      alert('Please select a customer');
      return;
    }

    setUploading(true);

    try {
      const fileExt = 'pdf';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${shop.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('repair-orders')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('repair-orders')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('repair_orders').insert({
        shop_id: shop.id,
        customer_id: formData.customer_id,
        vehicle_id: formData.vehicle_id || null,
        service_date: formData.service_date,
        file_url: urlData.publicUrl,
        total_amount: parseFloat(formData.total_amount) || 0,
        parts_cost: parseFloat(formData.parts_cost) || 0,
        labor_cost: parseFloat(formData.labor_cost) || 0,
        service_writer: formData.service_writer,
        notes: formData.notes,
      });

      if (insertError) throw insertError;

      alert('Repair order uploaded successfully!');
      setShowUploadModal(false);
      resetForm();
      loadRepairOrders();
    } catch (error: any) {
      console.error('Error uploading repair order:', error);
      alert('Failed to upload repair order: ' + (error?.message || 'Unknown error'));
    } finally {
      setUploading(false);
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

  const resetForm = () => {
    setFormData({
      customer_id: '',
      vehicle_id: '',
      service_date: new Date().toISOString().split('T')[0],
      total_amount: '',
      parts_cost: '',
      labor_cost: '',
      service_writer: '',
      notes: '',
    });
    setSelectedFile(null);
  };

  if (loading) {
    return <div className="text-slate-600">Loading repair orders...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Repair Orders</h2>
          <p className="text-slate-600">Manage customer repair order documents</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Upload className="w-5 h-5" />
          Upload Repair Order
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
            Upload Repair Order
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
                      <h3 className="text-lg font-bold text-slate-900">{order.customer.full_name}</h3>
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
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Upload Repair Order</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  PDF File *
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={handleFileSelect}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {selectedFile && (
                  <p className="text-sm text-slate-600 mt-1">Selected: {selectedFile.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Customer *
                </label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value, vehicle_id: '' })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select a customer</option>
                  {customers.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.full_name} - {cust.email}
                    </option>
                  ))}
                </select>
              </div>

              {vehicles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Vehicle (Optional)
                  </label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">No vehicle selected</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Service Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.service_date}
                  onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Total Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Parts Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.parts_cost}
                    onChange={(e) => setFormData({ ...formData, parts_cost: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Labor Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.labor_cost}
                    onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Service Writer
                </label>
                <input
                  type="text"
                  value={formData.service_writer}
                  onChange={(e) => setFormData({ ...formData, service_writer: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g., Travis Seymour"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Additional notes about this repair order..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
