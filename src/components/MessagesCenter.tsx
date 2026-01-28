import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { supabase } from '../lib/supabase';
import { MessageSquare } from 'lucide-react';
import { ChatThread } from './ChatThread';
import { getSmsOptStatus, setSmsOptStatus } from '../lib/messaging';
import type { Customer } from '../types/database';

type MessagesCenterProps = {
  mode: 'admin' | 'customer';
};

export function MessagesCenter({ mode }: MessagesCenterProps) {
  const { admin, customer } = useAuth();
  const { brandSettings } = useBrand();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [smsStatus, setSmsStatus] = useState<'opted_in' | 'opted_out' | 'unknown'>('unknown');

  useEffect(() => {
    if (mode !== 'admin' || !admin?.shop_id) return;
    loadCustomers();
  }, [mode, admin?.shop_id]);

  useEffect(() => {
    if (mode !== 'customer' || !customer) return;
    (async () => {
      const status = await getSmsOptStatus(customer.shop_id, customer.id);
      if (status === 'opted_in' || status === 'opted_out') {
        setSmsStatus(status);
      }
    })();
  }, [mode, customer?.id, customer?.shop_id]);

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', admin?.shop_id || '')
      .order('full_name', { ascending: true });
    if (error) {
      console.error('Failed to load customers:', error);
      return;
    }
    setCustomers((data || []) as Customer[]);
    if (!selectedCustomerId && data && data.length > 0) {
      setSelectedCustomerId(data[0].id);
    }
  };

  if (mode === 'customer') {
    if (!customer) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-700">
          <MessageSquare className="w-5 h-5" />
          <h2 className="text-2xl font-bold text-slate-900">Messages</h2>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <p className="text-sm font-medium text-slate-900">SMS Updates</p>
          <p className="text-xs text-slate-500">
            Receive SMS reminders and updates when enabled by your shop.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={smsStatus !== 'opted_out'}
              onChange={async (e) => {
                const nextStatus = e.target.checked ? 'opted_in' : 'opted_out';
                await setSmsOptStatus(customer.shop_id, customer.id, nextStatus);
                setSmsStatus(nextStatus);
              }}
            />
            {smsStatus === 'opted_out' ? 'SMS disabled' : 'SMS enabled'}
          </label>
        </div>
        <ChatThread
          shopId={customer.shop_id}
          customerId={customer.id}
          threadType="general"
          title="Contact your shop"
          subtitle="Ask questions or request updates"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-700">
        <MessageSquare className="w-5 h-5" />
        <h2 className="text-2xl font-bold text-slate-900">Messages</h2>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <label className="text-sm font-medium text-slate-700">Select Customer</label>
        <select
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
        >
          <option value="">Select customer</option>
          {customers.map((cust) => (
            <option key={cust.id} value={cust.id}>{cust.full_name}</option>
          ))}
        </select>
      </div>
      {selectedCustomerId && admin?.shop_id && (
        <ChatThread
          shopId={admin.shop_id}
          customerId={selectedCustomerId}
          threadType="general"
          title="Customer Conversation"
          subtitle="General customer chat thread"
        />
      )}
      {!selectedCustomerId && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          Select a customer to start messaging.
        </div>
      )}
      {customers.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          No customers yet.
        </div>
      )}
      {customers.length > 0 && !selectedCustomerId && (
        <button
          onClick={() => setSelectedCustomerId(customers[0].id)}
          className="px-4 py-2 text-white rounded-lg"
          style={{ backgroundColor: brandSettings.primary_color }}
        >
          Select First Customer
        </button>
      )}
    </div>
  );
}
