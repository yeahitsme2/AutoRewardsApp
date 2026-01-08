import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { Settings as SettingsIcon, Save, DollarSign, Award, Palette, Image } from 'lucide-react';
import type { ShopSettings } from '../types/database';

export function Settings() {
  const { customer } = useAuth();
  const { refreshBrand } = useBrand();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [pointsPerDollar, setPointsPerDollar] = useState<number>(10);
  const [tierSettings, setTierSettings] = useState({
    bronze_points_min: 0,
    bronze_multiplier: 1.0,
    silver_points_min: 500,
    silver_multiplier: 1.25,
    gold_points_min: 1500,
    gold_multiplier: 1.5,
    platinum_points_min: 3000,
    platinum_multiplier: 2.0,
  });
  const [brandSettings, setBrandSettings] = useState({
    shop_logo_url: '',
    primary_color: '#10b981',
    secondary_color: '#059669',
    accent_color: '#047857',
    header_text: 'Auto Shop Rewards',
    welcome_message: 'Welcome back',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setPointsPerDollar(Number(data.points_per_dollar));
        setTierSettings({
          bronze_points_min: Number(data.bronze_points_min),
          bronze_multiplier: Number(data.bronze_multiplier),
          silver_points_min: Number(data.silver_points_min),
          silver_multiplier: Number(data.silver_multiplier),
          gold_points_min: Number(data.gold_points_min),
          gold_multiplier: Number(data.gold_multiplier),
          platinum_points_min: Number(data.platinum_points_min),
          platinum_multiplier: Number(data.platinum_multiplier),
        });
        setBrandSettings({
          shop_logo_url: data.shop_logo_url || '',
          primary_color: data.primary_color || '#10b981',
          secondary_color: data.secondary_color || '#059669',
          accent_color: data.accent_color || '#047857',
          header_text: data.header_text || 'Auto Shop Rewards',
          welcome_message: data.welcome_message || 'Welcome back',
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showMessage('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !customer) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('shop_settings')
        .update({
          points_per_dollar: pointsPerDollar,
          ...tierSettings,
          ...brandSettings,
          shop_logo_url: brandSettings.shop_logo_url || null,
          updated_at: new Date().toISOString(),
          updated_by: customer.id,
        })
        .eq('id', settings.id);

      if (error) throw error;

      showMessage('success', 'Settings saved successfully');
      loadSettings();
      refreshBrand();
    } catch (error) {
      console.error('Error saving settings:', error);
      showMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Shop Settings</h3>
              <p className="text-sm text-slate-600">Configure reward system and other options</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          <div>
            <h4 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-slate-700" />
              Brand Customization
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Shop Logo URL
                </label>
                <div className="flex items-start gap-3">
                  <div className="relative flex-1">
                    <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="url"
                      value={brandSettings.shop_logo_url}
                      onChange={(e) => setBrandSettings({ ...brandSettings, shop_logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  {brandSettings.shop_logo_url && (
                    <div className="w-12 h-12 border-2 border-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={brandSettings.shop_logo_url}
                        alt="Shop logo preview"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Enter the URL of your shop logo. This will replace the default icon throughout the app.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Header Text
                </label>
                <input
                  type="text"
                  value={brandSettings.header_text}
                  onChange={(e) => setBrandSettings({ ...brandSettings, header_text: e.target.value })}
                  placeholder="Auto Shop Rewards"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
                <p className="mt-2 text-sm text-slate-500">
                  This text appears as the main header in the dashboard.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Welcome Message
                </label>
                <input
                  type="text"
                  value={brandSettings.welcome_message}
                  onChange={(e) => setBrandSettings({ ...brandSettings, welcome_message: e.target.value })}
                  placeholder="Welcome back"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
                <p className="mt-2 text-sm text-slate-500">
                  This message greets customers in the dashboard (e.g., "Welcome back, John").
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandSettings.primary_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, primary_color: e.target.value })}
                      className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandSettings.primary_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, primary_color: e.target.value })}
                      placeholder="#10b981"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono text-sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Main buttons & accents</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandSettings.secondary_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, secondary_color: e.target.value })}
                      className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandSettings.secondary_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, secondary_color: e.target.value })}
                      placeholder="#059669"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono text-sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Hover states</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandSettings.accent_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, accent_color: e.target.value })}
                      className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandSettings.accent_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, accent_color: e.target.value })}
                      placeholder="#047857"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono text-sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Highlights & badges</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-slate-900 mb-3">Color Preview</h5>
                <div className="flex gap-3">
                  <button
                    type="button"
                    style={{ backgroundColor: brandSettings.primary_color }}
                    className="px-4 py-2 text-white font-medium rounded-lg"
                  >
                    Primary Button
                  </button>
                  <button
                    type="button"
                    style={{ backgroundColor: brandSettings.secondary_color }}
                    className="px-4 py-2 text-white font-medium rounded-lg"
                  >
                    Secondary Button
                  </button>
                  <span
                    style={{ backgroundColor: brandSettings.accent_color }}
                    className="px-3 py-1 text-white text-sm font-medium rounded-full"
                  >
                    Accent Badge
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-base font-semibold text-slate-900 mb-4">Rewards Configuration</h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Points Per Dollar Spent
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={pointsPerDollar}
                      onChange={(e) => setPointsPerDollar(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <span className="text-sm text-slate-600">points per $1.00</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  For example, if set to 10, a customer spending $50 will earn 500 points.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-blue-900 mb-2">How Points Work</h5>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Points are automatically calculated when service records are added</p>
                  <p>• Tier multipliers apply on top of base points (e.g., 1.5x for Gold tier)</p>
                  <p>• Customers can redeem points for rewards in the Rewards tab</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Tier Configuration
            </h4>

            <div className="space-y-6">
              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-amber-800 text-white rounded-full flex items-center justify-center text-xs">B</span>
                  Bronze Tier
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Minimum Points
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={tierSettings.bronze_points_min}
                      onChange={(e) => setTierSettings({ ...tierSettings, bronze_points_min: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Points Multiplier
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={tierSettings.bronze_multiplier}
                      onChange={(e) => setTierSettings({ ...tierSettings, bronze_multiplier: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-100 border-2 border-slate-300 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-slate-500 text-white rounded-full flex items-center justify-center text-xs">S</span>
                  Silver Tier
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Minimum Points
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={tierSettings.silver_points_min}
                      onChange={(e) => setTierSettings({ ...tierSettings, silver_points_min: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Points Multiplier
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={tierSettings.silver_multiplier}
                      onChange={(e) => setTierSettings({ ...tierSettings, silver_multiplier: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-xs">G</span>
                  Gold Tier
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Minimum Points
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={tierSettings.gold_points_min}
                      onChange={(e) => setTierSettings({ ...tierSettings, gold_points_min: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Points Multiplier
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={tierSettings.gold_multiplier}
                      onChange={(e) => setTierSettings({ ...tierSettings, gold_multiplier: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-cyan-50 border-2 border-cyan-400 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-cyan-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-cyan-600 text-white rounded-full flex items-center justify-center text-xs">P</span>
                  Platinum Tier
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Minimum Points
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={tierSettings.platinum_points_min}
                      onChange={(e) => setTierSettings({ ...tierSettings, platinum_points_min: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Points Multiplier
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={tierSettings.platinum_multiplier}
                      onChange={(e) => setTierSettings({ ...tierSettings, platinum_multiplier: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-emerald-900 mb-2">How Tiers Work</h5>
                <div className="text-sm text-emerald-800 space-y-1">
                  <p>• Customer tiers are automatically calculated based on their current reward points</p>
                  <p>• Tier multipliers increase the points earned per dollar spent</p>
                  <p>• Changing tier thresholds will immediately affect all customers</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {message && (
            <div
              className={`text-sm font-medium ${
                message.type === 'success' ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {message.text}
            </div>
          )}
          <div className="ml-auto">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
