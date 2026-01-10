import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { useShop } from '../lib/ShopContext';
import { Settings as SettingsIcon, Save, DollarSign, Award, Palette, Image, Store, QrCode, Download } from 'lucide-react';
import QRCodeLib from 'qrcode';
import type { ShopSettings } from '../types/database';

export function Settings() {
  const { customer } = useAuth();
  const { refreshBrand } = useBrand();
  const { shop } = useShop();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [shopName, setShopName] = useState('');
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
    logo_url: '',
    primary_color: '#10b981',
    secondary_color: '#0f172a',
    welcome_message: 'Welcome back',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (shop?.id) {
      loadSettings();
      generateQRCode();
    }
  }, [shop?.id]);

  const generateQRCode = async () => {
    if (!shop?.id) return;

    const signupUrl = `${window.location.origin}/?shop=${shop.id}`;

    try {
      if (qrCanvasRef.current) {
        await QRCodeLib.toCanvas(qrCanvasRef.current, signupUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff',
          },
        });
      }

      const dataUrl = await QRCodeLib.toDataURL(signupUrl, {
        width: 512,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.download = `${shop?.name || 'shop'}-signup-qr.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const loadSettings = async () => {
    if (!shop?.id) {
      setLoading(false);
      return;
    }

    try {
      setShopName(shop.name);

      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .eq('shop_id', shop.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setPointsPerDollar(Number(data.points_per_dollar));
        setTierSettings({
          bronze_points_min: Number(data.bronze_points_min || 0),
          bronze_multiplier: Number(data.bronze_multiplier || 1.0),
          silver_points_min: Number(data.silver_points_min || 500),
          silver_multiplier: Number(data.silver_multiplier || 1.25),
          gold_points_min: Number(data.gold_points_min || 1500),
          gold_multiplier: Number(data.gold_multiplier || 1.5),
          platinum_points_min: Number(data.platinum_points_min || 3000),
          platinum_multiplier: Number(data.platinum_multiplier || 2.0),
        });
        setBrandSettings({
          logo_url: data.logo_url || '',
          primary_color: data.primary_color || '#10b981',
          secondary_color: data.secondary_color || '#0f172a',
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
    if (!settings || !customer || !shop?.id) return;

    setSaving(true);
    setMessage(null);

    try {
      if (shopName !== shop.name) {
        const { error: shopError } = await supabase
          .from('shops')
          .update({ name: shopName })
          .eq('id', shop.id);

        if (shopError) throw shopError;
      }

      const { error } = await supabase
        .from('shop_settings')
        .update({
          points_per_dollar: pointsPerDollar,
          ...tierSettings,
          ...brandSettings,
          logo_url: brandSettings.logo_url || null,
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
              <Store className="w-5 h-5 text-slate-700" />
              Shop Details
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Shop Name
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Your Auto Shop Name"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
                <p className="mt-2 text-sm text-slate-500">
                  This is your business name displayed throughout the app.
                </p>
              </div>

              {shop?.slug && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-sm text-slate-600">
                    <span className="font-medium">Shop URL Identifier:</span>{' '}
                    <code className="bg-slate-200 px-2 py-1 rounded text-slate-800">{shop.slug}</code>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    This identifier is used to access your shop. Share your unique URL with customers.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-slate-700" />
              Customer Signup QR Code
            </h4>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="bg-white p-4 rounded-lg shadow-sm border-2 border-slate-300">
                    <canvas ref={qrCanvasRef} className="w-64 h-64" />
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-900 mb-2">
                      How to use this QR code
                    </h5>
                    <ul className="text-sm text-slate-600 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 mt-0.5">•</span>
                        <span>Display this QR code in your shop where customers can easily scan it</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 mt-0.5">•</span>
                        <span>When scanned, it directs customers to a signup page specifically for your shop</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 mt-0.5">•</span>
                        <span>New customers will automatically be associated with your shop</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 mt-0.5">•</span>
                        <span>Download and print the QR code to display at your counter or waiting area</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={downloadQRCode}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download QR Code
                  </button>

                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Signup URL:</p>
                    <code className="text-xs text-slate-700 break-all">
                      {window.location.origin}/?shop={shop?.id}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
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
                      value={brandSettings.logo_url}
                      onChange={(e) => setBrandSettings({ ...brandSettings, logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  {brandSettings.logo_url && (
                    <div className="w-12 h-12 border-2 border-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={brandSettings.logo_url}
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
