import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Shop, SuperAdmin } from '../types/database';
import {
  Building2,
  Plus,
  Users,
  Settings,
  LogOut,
  Store,
  UserPlus,
  Shield,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
  AlertCircle
} from 'lucide-react';

interface ShopWithAdmin extends Shop {
  admin_count?: number;
  customer_count?: number;
}

interface CreateShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateShopModal({ isOpen, onClose, onCreated }: CreateShopModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(generateSlug(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: insertError } = await supabase
        .from('shops')
        .insert({ name, slug });

      if (insertError) throw insertError;

      onCreated();
      onClose();
      setName('');
      setSlug('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Create New Shop</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Shop Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="My Auto Shop"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="my-auto-shop"
              required
            />
            <p className="mt-1 text-xs text-slate-500">Used in URLs: yoursite.com/{slug}</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Shop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CreateAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop | null;
  onCreated: () => void;
}

function CreateAdminModal({ isOpen, onClose, shop, onCreated }: CreateAdminModalProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            shop_id: shop.id,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const { error: customerError } = await supabase
        .from('customers')
        .insert({
          auth_user_id: authData.user.id,
          shop_id: shop.id,
          email,
          full_name: fullName,
          is_admin: true,
        });

      if (customerError) throw customerError;

      setSuccess(`Admin account created for ${email}`);
      setEmail('');
      setFullName('');
      setPassword('');
      onCreated();

      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !shop) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create Shop Admin</h2>
            <p className="text-sm text-slate-500 mt-1">For: {shop.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="John Smith"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="admin@shop.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Min 6 characters"
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SuperAdminDashboardProps {
  superAdmin: SuperAdmin;
  onSignOut: () => void;
}

export function SuperAdminDashboard({ superAdmin, onSignOut }: SuperAdminDashboardProps) {
  const [shops, setShops] = useState<ShopWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    try {
      const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (shopsError) throw shopsError;

      const shopsWithCounts = await Promise.all(
        (shopsData || []).map(async (shop) => {
          const { count: adminCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shop.id)
            .eq('is_admin', true);

          const { count: customerCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shop.id);

          return {
            ...shop,
            admin_count: adminCount || 0,
            customer_count: customerCount || 0,
          };
        })
      );

      setShops(shopsWithCounts);
    } catch (error) {
      console.error('Error loading shops:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleShopActive = async (shop: Shop) => {
    try {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: !shop.is_active })
        .eq('id', shop.id);

      if (error) throw error;
      loadShops();
    } catch (error) {
      console.error('Error toggling shop:', error);
    }
  };

  const deleteShop = async (shop: Shop) => {
    if (!confirm(`Are you sure you want to delete "${shop.name}"? This will delete all associated data.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', shop.id);

      if (error) throw error;
      loadShops();
    } catch (error) {
      console.error('Error deleting shop:', error);
    }
  };

  const openCreateAdmin = (shop: Shop) => {
    setSelectedShop(shop);
    setShowCreateAdmin(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Super Admin</h1>
                <p className="text-xs text-slate-400">Platform Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-300">{superAdmin.email}</span>
              <button
                onClick={onSignOut}
                className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Shops</p>
                <p className="text-3xl font-bold text-white mt-1">{shops.length}</p>
              </div>
              <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center">
                <Store className="w-6 h-6 text-teal-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Shops</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {shops.filter(s => s.is_active).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Users</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {shops.reduce((sum, s) => sum + (s.customer_count || 0), 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Shops</h2>
              <button
                onClick={() => setShowCreateShop(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Shop
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-400 mt-4">Loading shops...</p>
            </div>
          ) : shops.length === 0 ? (
            <div className="p-12 text-center">
              <Store className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No shops yet. Create your first shop to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {shops.map((shop) => (
                <div key={shop.id} className="p-6 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        shop.is_active ? 'bg-teal-500/20' : 'bg-slate-600/20'
                      }`}>
                        <Store className={`w-6 h-6 ${shop.is_active ? 'text-teal-400' : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{shop.name}</h3>
                        <p className="text-sm text-slate-400">/{shop.slug}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-white">{shop.admin_count}</p>
                        <p className="text-xs text-slate-400">Admins</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-white">{shop.customer_count}</p>
                        <p className="text-xs text-slate-400">Users</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openCreateAdmin(shop)}
                          className="p-2 text-slate-400 hover:text-teal-400 hover:bg-teal-400/10 rounded-lg transition-colors"
                          title="Add Admin"
                        >
                          <UserPlus className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => toggleShopActive(shop)}
                          className={`p-2 rounded-lg transition-colors ${
                            shop.is_active
                              ? 'text-green-400 hover:bg-green-400/10'
                              : 'text-slate-500 hover:bg-slate-500/10'
                          }`}
                          title={shop.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {shop.is_active ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteShop(shop)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Delete Shop"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      shop.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-600/20 text-slate-500'
                    }`}>
                      {shop.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-slate-500">
                      Created {new Date(shop.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateShopModal
        isOpen={showCreateShop}
        onClose={() => setShowCreateShop(false)}
        onCreated={loadShops}
      />

      <CreateAdminModal
        isOpen={showCreateAdmin}
        onClose={() => {
          setShowCreateAdmin(false);
          setSelectedShop(null);
        }}
        shop={selectedShop}
        onCreated={loadShops}
      />
    </div>
  );
}
