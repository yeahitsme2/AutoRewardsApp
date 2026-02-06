import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBrand } from '../lib/BrandContext';
import { useShop } from '../lib/ShopContext';
import { Gift, Plus, Edit2, Trash2, Award } from 'lucide-react';
import type { RewardItem, Customer } from '../types/database';

interface RewardItemWithEdit extends RewardItem {
  editing?: boolean;
}

export function RewardsManagement() {
  const { brandSettings } = useBrand();
  const { shop } = useShop();
  const [rewardItems, setRewardItems] = useState<RewardItemWithEdit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    points_required: '',
  });
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    points_required: '',
  });

  const getPointsCost = (reward: RewardItem) =>
    (reward as any).points_required ?? (reward as any).points_cost ?? 0;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rewardsResult, customersResult] = await Promise.all([
        supabase.from('reward_items').select('*'),
        supabase.from('customers').select('*').order('full_name', { ascending: true }),
      ]);

      if (rewardsResult.error) throw rewardsResult.error;
      if (customersResult.error) throw customersResult.error;

      const sortedRewards = (rewardsResult.data || []).slice().sort((a, b) => {
        const costA = (a as any).points_required ?? (a as any).points_cost ?? 0;
        const costB = (b as any).points_required ?? (b as any).points_cost ?? 0;
        return costA - costB;
      });
      setRewardItems(sortedRewards);
      setCustomers(customersResult.data || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReward = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shop?.id) {
      alert('Shop not loaded. Please refresh and try again.');
      return;
    }

    try {
      const pointsValue = parseInt(formData.points_required);
      let { error } = await supabase.from('reward_items').insert({
        shop_id: shop.id,
        name: formData.name,
        description: formData.description,
        points_required: pointsValue,
        is_active: true,
      });

      if (error && error.code === '42703') {
        ({ error } = await supabase.from('reward_items').insert({
          shop_id: shop.id,
          name: formData.name,
          description: formData.description,
          points_cost: pointsValue,
          is_active: true,
        }));
      }

      if (error) throw error;

      setFormData({ name: '', description: '', points_required: '' });
      setShowAddForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding reward:', error);
      alert('Failed to add reward. Please try again.');
    }
  };

  const handleToggleActive = async (reward: RewardItem) => {
    try {
      const { error } = await supabase
        .from('reward_items')
        .update({ is_active: !reward.is_active })
        .eq('id', reward.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating reward:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;

    try {
      const { error } = await supabase.from('reward_items').delete().eq('id', id);

      if (error) throw error;

      await loadData();
    } catch (error: any) {
      console.error('Error deleting reward:', error);

      await loadData();

      const stillExists = rewardItems.some(r => r.id === id);
      if (!stillExists) {
        return;
      }

      alert('Failed to delete reward. It may have existing redemptions.');
    }
  };

  const startEdit = (reward: RewardItem) => {
    setEditingId(reward.id);
    setEditData({
      name: reward.name,
      description: reward.description || '',
      points_required: getPointsCost(reward).toString(),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ name: '', description: '', points_required: '' });
  };

  const handleUpdate = async (id: string) => {
    try {
      const pointsValue = parseInt(editData.points_required);
      let { error } = await supabase
        .from('reward_items')
        .update({
          name: editData.name,
          description: editData.description,
          points_required: pointsValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error && error.code === '42703') {
        ({ error } = await supabase
          .from('reward_items')
          .update({
            name: editData.name,
            description: editData.description,
            points_cost: pointsValue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id));
      }

      if (error) throw error;

      setEditingId(null);
      setEditData({ name: '', description: '', points_required: '' });
      loadData();
    } catch (error) {
      console.error('Error updating reward:', error);
      alert('Failed to update reward. Please try again.');
    }
  };

  const handleRedeemForCustomer = async (customerId: string) => {
    if (!selectedReward) return;

    try {
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) return;

      const pointsCost = getPointsCost(selectedReward);
      if (customer.reward_points < pointsCost) {
        alert('Customer does not have enough points for this reward.');
        return;
      }

      const { error } = await supabase.from('reward_redemptions').insert({
        customer_id: customerId,
        reward_item_id: selectedReward.id,
        points_spent: pointsCost,
        status: 'completed',
      });

      if (error) throw error;

      alert('Reward redeemed successfully!');
      setShowRedeemModal(false);
      setSelectedReward(null);
      loadData();
    } catch (error) {
      console.error('Error redeeming reward:', error);
      alert('Failed to redeem reward. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading rewards...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-6 h-6" style={{ color: brandSettings.primary_color }} />
          <h2 className="text-2xl font-bold text-slate-900">Rewards Management</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
          style={{ backgroundColor: brandSettings.primary_color }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = brandSettings.secondary_color}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = brandSettings.primary_color}
        >
          <Plus className="w-5 h-5" />
          <span>Add Reward</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Reward</h3>
          <form onSubmit={handleAddReward} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reward Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Free Oil Change"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the reward..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Points Required</label>
              <input
                type="number"
                required
                min="1"
                value={formData.points_required}
                onChange={(e) => setFormData({ ...formData, points_required: e.target.value })}
                placeholder="e.g., 500"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ name: '', description: '', points_required: '' });
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-white rounded-lg transition-colors"
                style={{ backgroundColor: brandSettings.primary_color }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = brandSettings.secondary_color}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = brandSettings.primary_color}
              >
                Add Reward
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewardItems.map((reward) => (
          <div
            key={reward.id}
            className="bg-white rounded-xl shadow-sm border-2 transition-all"
            style={{
              borderColor: reward.is_active ? `${brandSettings.primary_color}40` : '#e2e8f0',
              opacity: reward.is_active ? 1 : 0.6
            }}
          >
            {editingId === reward.id ? (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reward Name</label>
                  <input
                    type="text"
                    required
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    required
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Points Required</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editData.points_required}
                    onChange={(e) => setEditData({ ...editData, points_required: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={cancelEdit}
                    className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdate(reward.id)}
                    className="flex-1 px-3 py-2 text-white rounded-lg text-sm transition-colors"
                    style={{ backgroundColor: brandSettings.primary_color }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = brandSettings.secondary_color}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = brandSettings.primary_color}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{reward.name}</h3>
                    <p className="text-sm text-slate-600">{reward.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(reward)}
                      className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(reward)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={reward.is_active ? {
                        backgroundColor: `${brandSettings.primary_color}20`,
                        color: brandSettings.primary_color
                      } : { backgroundColor: '#f1f5f9', color: '#64748b' }}
                      title={reward.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <Gift className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(reward.id)}
                      className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-1.5 font-semibold" style={{ color: brandSettings.primary_color }}>
                    <Award className="w-5 h-5" />
                    <span>{getPointsCost(reward)} pts</span>
                  </div>
                  {reward.is_active && (
                    <button
                      onClick={() => {
                        setSelectedReward(reward);
                        setShowRedeemModal(true);
                      }}
                      className="px-3 py-1.5 text-white text-sm rounded-lg transition-colors"
                      style={{ backgroundColor: brandSettings.primary_color }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = brandSettings.secondary_color}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = brandSettings.primary_color}
                    >
                      Redeem for Customer
                    </button>
                  )}
                </div>

                {!reward.is_active && (
                  <div className="mt-2 text-xs text-slate-500 font-medium">Inactive</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {rewardItems.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Gift className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Rewards Yet</h3>
          <p className="text-slate-600">Add reward items that customers can redeem with points.</p>
        </div>
      )}

      {showRedeemModal && selectedReward && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Redeem Reward</h3>
              <p className="text-sm text-slate-600 mt-1">
                {selectedReward.name} ({getPointsCost(selectedReward)} points)
              </p>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              <p className="text-sm text-slate-600 mb-4">Select a customer to redeem this reward for:</p>
              <div className="space-y-2">
                {customers
                  .filter((c) => !c.is_admin)
                  .map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleRedeemForCustomer(customer.id)}
                      disabled={customer.reward_points < getPointsCost(selectedReward)}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{customer.full_name}</p>
                          <p className="text-sm text-slate-600">{customer.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold" style={{ color: brandSettings.primary_color }}>
                            {customer.reward_points} pts
                          </p>
                          {customer.reward_points < getPointsCost(selectedReward) && (
                            <p className="text-xs text-red-600">Not enough points</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowRedeemModal(false);
                  setSelectedReward(null);
                }}
                className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
