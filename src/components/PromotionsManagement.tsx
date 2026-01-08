import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { Percent, DollarSign, Sparkles, Gift, Plus, Users, X, Check, Crown, Calendar, Tag } from 'lucide-react';
import { getTierInfo } from '../lib/rewardsUtils';
import type { Promotion, Customer } from '../types/database';

interface PromotionWithRecipients extends Promotion {
  recipient_count: number;
}

export function PromotionsManagement() {
  const { customer } = useAuth();
  const { brandSettings } = useBrand();
  const [promotions, setPromotions] = useState<PromotionWithRecipients[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount' | 'points_bonus' | 'free_service',
    discount_value: 0,
    promo_code: '',
    valid_until: '',
  });

  useEffect(() => {
    loadPromotions();
    loadCustomers();
  }, []);

  const loadPromotions = async () => {
    try {
      const { data: promoData, error: promoError } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });

      if (promoError) throw promoError;

      const promotionsWithCounts = await Promise.all(
        (promoData || []).map(async (promo) => {
          const { count, error } = await supabase
            .from('customer_promotions')
            .select('*', { count: 'exact', head: true })
            .eq('promotion_id', promo.id);

          return {
            ...promo,
            recipient_count: error ? 0 : count || 0,
          };
        })
      );

      setPromotions(promotionsWithCounts);
    } catch (error) {
      console.error('Error loading promotions:', error);
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

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('promotions').insert({
        title: formData.title,
        description: formData.description,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        promo_code: formData.promo_code || null,
        valid_until: formData.valid_until,
        is_active: true,
        created_by: customer?.id,
      });

      if (error) throw error;

      setFormData({
        title: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 0,
        promo_code: '',
        valid_until: '',
      });
      setShowCreateForm(false);
      loadPromotions();
    } catch (error) {
      console.error('Error creating promotion:', error);
      alert('Failed to create promotion');
    }
  };

  const handleToggleActive = async (promotion: Promotion) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !promotion.is_active, updated_at: new Date().toISOString() })
        .eq('id', promotion.id);

      if (error) throw error;
      loadPromotions();
    } catch (error) {
      console.error('Error updating promotion:', error);
    }
  };

  const openSendModal = (promotion: Promotion) => {
    setSelectedPromotion(promotion);
    setSelectedCustomers(new Set());
    setShowSendModal(true);
  };

  const toggleCustomerSelection = (customerId: string) => {
    const newSelection = new Set(selectedCustomers);
    if (newSelection.has(customerId)) {
      newSelection.delete(customerId);
    } else {
      newSelection.add(customerId);
    }
    setSelectedCustomers(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.size === customers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(customers.map((c) => c.id)));
    }
  };

  const handleSendToCustomers = async () => {
    if (!selectedPromotion || selectedCustomers.size === 0) return;

    setSending(true);
    try {
      const existingPromotions = await supabase
        .from('customer_promotions')
        .select('customer_id')
        .eq('promotion_id', selectedPromotion.id);

      const existingCustomerIds = new Set(
        existingPromotions.data?.map((cp) => cp.customer_id) || []
      );

      const newCustomerIds = Array.from(selectedCustomers).filter(
        (id) => !existingCustomerIds.has(id)
      );

      if (newCustomerIds.length === 0) {
        alert('All selected customers have already received this promotion');
        setSending(false);
        return;
      }

      const { error } = await supabase.from('customer_promotions').insert(
        newCustomerIds.map((customerId) => ({
          customer_id: customerId,
          promotion_id: selectedPromotion.id,
        }))
      );

      if (error) throw error;

      alert(`Promotion sent to ${newCustomerIds.length} customer(s)!`);
      setShowSendModal(false);
      setSelectedPromotion(null);
      setSelectedCustomers(new Set());
      loadPromotions();
    } catch (error) {
      console.error('Error sending promotion:', error);
      alert('Failed to send promotion');
    } finally {
      setSending(false);
    }
  };

  const getDiscountIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <Percent className="w-5 h-5" />;
      case 'fixed_amount':
        return <DollarSign className="w-5 h-5" />;
      case 'points_bonus':
        return <Sparkles className="w-5 h-5" />;
      case 'free_service':
        return <Gift className="w-5 h-5" />;
      default:
        return <Tag className="w-5 h-5" />;
    }
  };

  const formatDiscountDisplay = (promo: Promotion) => {
    switch (promo.discount_type) {
      case 'percentage':
        return `${promo.discount_value}% off`;
      case 'fixed_amount':
        return `$${promo.discount_value} off`;
      case 'points_bonus':
        return `${promo.discount_value}x points multiplier`;
      case 'free_service':
        return 'Free service';
      default:
        return '';
    }
  };

  if (loading) {
    return <div className="text-slate-600">Loading promotions...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Promotions</h2>
          <p className="text-slate-600">Create and manage special offers for your customers</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Promotion
        </button>
      </div>

      {promotions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Gift className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Promotions Yet</h3>
          <p className="text-slate-600 mb-4">Create your first promotion to start engaging customers</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Promotion
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className={`bg-white rounded-xl shadow-sm border-2 ${
                promo.is_active ? 'border-emerald-200' : 'border-slate-200'
              } overflow-hidden`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          promo.is_active
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {getDiscountIcon(promo.discount_type)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{promo.title}</h3>
                        <p className="text-emerald-600 font-semibold">{formatDiscountDisplay(promo)}</p>
                      </div>
                    </div>
                    <p className="text-slate-700 mb-3">{promo.description}</p>

                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      {promo.promo_code && (
                        <div className="flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          <span className="font-mono font-semibold">{promo.promo_code}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Valid until {new Date(promo.valid_until).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Sent to {promo.recipient_count} customer(s)
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        promo.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {promo.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => openSendModal(promo)}
                    disabled={!promo.is_active}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
                  >
                    Send to Customers
                  </button>
                  <button
                    onClick={() => handleToggleActive(promo)}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      promo.is_active
                        ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                    }`}
                  >
                    {promo.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Create New Promotion</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreatePromotion} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Promotion Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="e.g., Spring Oil Change Special"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                  placeholder="Describe the offer in detail..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Discount Type
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discount_type: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  >
                    <option value="percentage">Percentage Off</option>
                    <option value="fixed_amount">Fixed Amount Off</option>
                    <option value="points_bonus">Points Multiplier</option>
                    <option value="free_service">Free Service</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_value: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    placeholder={formData.discount_type === 'percentage' ? '10' : '25.00'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Promo Code (optional)
                </label>
                <input
                  type="text"
                  value={formData.promo_code}
                  onChange={(e) => setFormData({ ...formData, promo_code: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="e.g., SPRING2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Valid Until
                </label>
                <input
                  type="date"
                  required
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Create Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSendModal && selectedPromotion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Send Promotion</h3>
                <p className="text-sm text-slate-600">{selectedPromotion.title}</p>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600">
                  Select customers to receive this promotion
                </p>
                <button
                  onClick={toggleSelectAll}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  {selectedCustomers.size === customers.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-2">
                {customers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => toggleCustomerSelection(cust.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedCustomers.has(cust.id)
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedCustomers.has(cust.id)
                              ? 'border-emerald-500 bg-emerald-500'
                              : 'border-slate-300'
                          }`}
                        >
                          {selectedCustomers.has(cust.id) && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900">{cust.full_name}</p>
                            {(() => {
                              const tierInfo = getTierInfo(cust.tier);
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r ${tierInfo.gradient} text-white text-xs font-medium rounded-full`}
                                >
                                  <Crown className="w-3 h-3" />
                                  {tierInfo.displayName}
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-sm text-slate-600">{cust.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">
                          {cust.reward_points} pts
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendToCustomers}
                  disabled={selectedCustomers.size === 0 || sending}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {sending
                    ? 'Sending...'
                    : `Send to ${selectedCustomers.size} Customer${
                        selectedCustomers.size !== 1 ? 's' : ''
                      }`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
