import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { useShop } from '../lib/ShopContext';
import { Settings as SettingsIcon, Save, DollarSign, Award, Palette, Image, Store, QrCode, Download, Copy, Check, Wrench } from 'lucide-react';
import QRCodeLib from 'qrcode';
import type { ShopSettings } from '../types/database';

const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const serviceCatalog = [
  'Oil Change',
  'Tire Rotation',
  'Brake Service',
  'Engine Diagnostic',
  'Transmission Service',
  'AC Service',
  'General Inspection',
  'Component Replacement',
  'Other',
];

const defaultBusinessHours = [
  { day: 0, is_open: false, open_time: '08:00', close_time: '17:00' },
  { day: 1, is_open: true, open_time: '08:00', close_time: '17:00' },
  { day: 2, is_open: true, open_time: '08:00', close_time: '17:00' },
  { day: 3, is_open: true, open_time: '08:00', close_time: '17:00' },
  { day: 4, is_open: true, open_time: '08:00', close_time: '17:00' },
  { day: 5, is_open: true, open_time: '08:00', close_time: '17:00' },
  { day: 6, is_open: true, open_time: '09:00', close_time: '13:00' },
];

type SettingsTab = 'shop' | 'brand' | 'scheduling' | 'rewards' | 'repair_orders';

type MarkupRuleDraft = {
  id?: string;
  min_cost: number;
  max_cost: number | null;
  markup_percent: number;
  is_active: boolean;
};

export function Settings() {
  const { customer, admin } = useAuth();
  const { refreshBrand } = useBrand();
  const { shop, setShopById } = useShop();
  const currentUser = admin || customer;
  const publicBaseUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, '');
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('shop');
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
  const [schedulerSupported, setSchedulerSupported] = useState(true);
  const [scheduleSettings, setScheduleSettings] = useState({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    appointment_duration_minutes: 30,
    lead_time_minutes: 120,
    bay_count: 1,
    tech_count: 1,
    business_hours: defaultBusinessHours,
    auto_confirm_services: ['Oil Change', 'Tire Rotation'],
    approval_required_services: ['Engine Diagnostic', 'Component Replacement'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [markupRulesSupported, setMarkupRulesSupported] = useState(true);
  const [markupRules, setMarkupRules] = useState<MarkupRuleDraft[]>([]);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (shop?.id) {
      loadSettings();
      generateQRCode();
    }
  }, [shop?.id]);

  const generateQRCode = async () => {
    if (!shop?.slug) return;

    const signupUrl = `${publicBaseUrl}/?shop=${shop.slug}`;

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

  const copySignupUrl = async () => {
    if (!shop?.slug) return;

    const signupUrl = `${publicBaseUrl}/?shop=${shop.slug}`;

    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
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
          logo_url: data.shop_logo_url || '',
          primary_color: data.primary_color || '#10b981',
          secondary_color: data.secondary_color || '#0f172a',
          welcome_message: data.welcome_message || 'Welcome back',
        });
        const hasSchedulerFields = Object.prototype.hasOwnProperty.call(data, 'business_hours');
        setSchedulerSupported(hasSchedulerFields);
        if (hasSchedulerFields) {
          setScheduleSettings({
            timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            appointment_duration_minutes: Number(data.appointment_duration_minutes || 30),
            lead_time_minutes: Number(data.lead_time_minutes || 120),
            bay_count: Number(data.bay_count || 1),
            tech_count: Number(data.tech_count || 1),
            business_hours: (data.business_hours as any) || defaultBusinessHours,
            auto_confirm_services: (data.auto_confirm_services as string[]) || ['Oil Change', 'Tire Rotation'],
            approval_required_services: (data.approval_required_services as string[]) || ['Engine Diagnostic', 'Component Replacement'],
          });
        } else {
          setScheduleSettings((prev) => ({ ...prev }));
        }
      }

      const { data: markupData, error: markupError } = await supabase
        .from('repair_order_markup_rules')
        .select('*')
        .eq('shop_id', shop.id)
        .order('min_cost', { ascending: true });

      if (markupError) {
        const missing = markupError.code === '42P01' || markupError.message?.includes('repair_order_markup_rules');
        setMarkupRulesSupported(!missing);
        if (!missing) {
          console.error('Error loading markup rules:', markupError);
        }
        setMarkupRules([]);
      } else {
        setMarkupRulesSupported(true);
        setMarkupRules(
          (markupData || []).map((rule: any) => ({
            id: rule.id,
            min_cost: Number(rule.min_cost || 0),
            max_cost: rule.max_cost === null ? null : Number(rule.max_cost),
            markup_percent: Number(rule.markup_percent || 0),
            is_active: rule.is_active !== false,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showMessage('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !currentUser || !shop?.id) return;

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

      let updatedById = null;
      if (customer?.id) {
        updatedById = customer.id;
      } else if (admin?.auth_user_id) {
        const { data: adminCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('auth_user_id', admin.auth_user_id)
          .maybeSingle();
        updatedById = adminCustomer?.id || null;
      }

      const updateData = {
        points_per_dollar: pointsPerDollar,
        ...tierSettings,
        primary_color: brandSettings.primary_color,
        secondary_color: brandSettings.secondary_color,
        welcome_message: brandSettings.welcome_message,
        shop_logo_url: brandSettings.logo_url || null,
        ...(schedulerSupported ? {
          business_hours: scheduleSettings.business_hours,
          appointment_duration_minutes: scheduleSettings.appointment_duration_minutes,
          lead_time_minutes: scheduleSettings.lead_time_minutes,
          bay_count: scheduleSettings.bay_count,
          tech_count: scheduleSettings.tech_count,
          timezone: scheduleSettings.timezone,
          auto_confirm_services: scheduleSettings.auto_confirm_services,
          approval_required_services: scheduleSettings.approval_required_services,
        } : {}),
        updated_at: new Date().toISOString(),
        updated_by: updatedById,
      };

      console.log('Updating shop_settings with:', updateData);
      console.log('Settings ID:', settings.id);

      const { data, error } = await supabase
        .from('shop_settings')
        .update(updateData)
        .eq('id', settings.id)
        .select();

      console.log('Update result:', { data, error });

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      if (markupRulesSupported) {
        const invalidRule = markupRules.find((rule) => {
          const min = Number(rule.min_cost);
          const max = rule.max_cost === null ? null : Number(rule.max_cost);
          const markup = Number(rule.markup_percent);
          return !Number.isFinite(min)
            || min < 0
            || (max !== null && (!Number.isFinite(max) || max < min))
            || !Number.isFinite(markup)
            || markup < 0;
        });

        if (invalidRule) {
          throw new Error('One or more markup rules have invalid ranges or percentages.');
        }

        const { error: deleteError } = await supabase
          .from('repair_order_markup_rules')
          .delete()
          .eq('shop_id', shop.id);

        if (deleteError) throw deleteError;

        const nextRules = markupRules.map((rule) => ({
          shop_id: shop.id,
          min_cost: Number(rule.min_cost),
          max_cost: rule.max_cost === null || rule.max_cost === ('' as any) ? null : Number(rule.max_cost),
          markup_percent: Number(rule.markup_percent),
          is_active: rule.is_active !== false,
          updated_at: new Date().toISOString(),
        }));

        if (nextRules.length > 0) {
          const { error: insertError } = await supabase
            .from('repair_order_markup_rules')
            .insert(nextRules);
          if (insertError) throw insertError;
        }
      }

      showMessage('success', 'Settings saved successfully');

      if (shopName !== shop?.name && shop?.id) {
        await setShopById(shop.id);
      }

      await loadSettings();
      await refreshBrand();
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

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'shop', label: 'Shop Settings' },
    { id: 'brand', label: 'Brand Settings' },
    { id: 'scheduling', label: 'Scheduling Settings' },
    { id: 'rewards', label: 'Rewards Settings' },
    { id: 'repair_orders', label: 'Repair Order Settings' },
  ];

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
              <h3 className="text-lg font-semibold text-slate-900">Settings</h3>
              <p className="text-sm text-slate-600">Manage shop configuration, branding, scheduling, rewards, and RO markup</p>
            </div>
          </div>
        </div>

        <div className="px-6 border-b border-slate-200 bg-white">
          <div className="flex flex-wrap gap-2 py-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-8">
          {activeTab === 'shop' && (
          <>
          <div>
            <h4 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-slate-700" />
              Shop Details
            </h4>

            <div className="space-y-4">
              <div>
                <label htmlFor="shop-name" className="block text-sm font-medium text-slate-700 mb-2">
                  Shop Name
                </label>
                <input
                  id="shop-name"
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
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-medium text-slate-700">Signup URL:</p>
                      <button
                        onClick={copySignupUrl}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy URL
                          </>
                        )}
                      </button>
                    </div>
                    <code className="text-xs text-slate-600 break-all block">
                      {publicBaseUrl}/?shop={shop?.slug}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>
          )}

          {activeTab === 'brand' && (
          <>
          <div>
            <h4 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-slate-700" />
              Brand Customization
            </h4>

            <div className="space-y-4">
              <div>
                <label htmlFor="logo-url" className="block text-sm font-medium text-slate-700 mb-2">
                  Shop Logo URL
                </label>
                <div className="flex items-start gap-3">
                  <div className="relative flex-1">
                    <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="logo-url"
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
                <label htmlFor="welcome-message" className="block text-sm font-medium text-slate-700 mb-2">
                  Welcome Message
                </label>
                <input
                  id="welcome-message"
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
                  <label htmlFor="primary-color" className="block text-sm font-medium text-slate-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="primary-color"
                      type="color"
                      value={brandSettings.primary_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, primary_color: e.target.value })}
                      className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                      aria-label="Primary color picker"
                    />
                    <input
                      id="primary-color-text"
                      type="text"
                      value={brandSettings.primary_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, primary_color: e.target.value })}
                      placeholder="#10b981"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono text-sm"
                      aria-label="Primary color hex code"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Main buttons & accents</p>
                </div>

                <div>
                  <label htmlFor="secondary-color" className="block text-sm font-medium text-slate-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="secondary-color"
                      type="color"
                      value={brandSettings.secondary_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, secondary_color: e.target.value })}
                      className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                      aria-label="Secondary color picker"
                    />
                    <input
                      id="secondary-color-text"
                      type="text"
                      value={brandSettings.secondary_color}
                      onChange={(e) => setBrandSettings({ ...brandSettings, secondary_color: e.target.value })}
                      placeholder="#059669"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none font-mono text-sm"
                      aria-label="Secondary color hex code"
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
          </>
          )}

          {activeTab === 'scheduling' && (
          <>
          <div>
            <h4 className="text-base font-semibold text-slate-900 mb-4">Scheduling Settings</h4>

            {!schedulerSupported && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                Scheduler settings will save after the database schema is updated. You can configure them now and re-save later.
              </div>
            )}

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Time Zone</label>
                  <input
                    type="text"
                    value={scheduleSettings.timezone}
                    onChange={(e) => setScheduleSettings({ ...scheduleSettings, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="America/New_York"
                  />
                  <p className="mt-1 text-xs text-slate-500">Use an IANA time zone (e.g., America/New_York).</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Appointment Duration</label>
                  <input
                    type="number"
                    min={15}
                    step={5}
                    value={scheduleSettings.appointment_duration_minutes}
                    onChange={(e) => setScheduleSettings({ ...scheduleSettings, appointment_duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <p className="mt-1 text-xs text-slate-500">Minutes per appointment (default 30).</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Lead Time (minutes)</label>
                  <input
                    type="number"
                    min={0}
                    step={15}
                    value={scheduleSettings.lead_time_minutes}
                    onChange={(e) => setScheduleSettings({ ...scheduleSettings, lead_time_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <p className="mt-1 text-xs text-slate-500">Minimum time before an appointment can be booked.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bay Count</label>
                  <input
                    type="number"
                    min={1}
                    value={scheduleSettings.bay_count}
                    onChange={(e) => setScheduleSettings({ ...scheduleSettings, bay_count: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tech Count</label>
                  <input
                    type="number"
                    min={1}
                    value={scheduleSettings.tech_count}
                    onChange={(e) => setScheduleSettings({ ...scheduleSettings, tech_count: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-slate-900 mb-2">Business Hours</h5>
                <div className="space-y-2">
                  {scheduleSettings.business_hours.map((dayConfig: any, idx: number) => (
                    <div key={dayConfig.day} className="flex flex-wrap items-center gap-3 border border-slate-200 rounded-lg p-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 w-28">
                        <input
                          type="checkbox"
                          checked={dayConfig.is_open}
                          onChange={(e) => {
                            const next = [...scheduleSettings.business_hours];
                            next[idx] = { ...dayConfig, is_open: e.target.checked };
                            setScheduleSettings({ ...scheduleSettings, business_hours: next });
                          }}
                        />
                        {dayLabels[dayConfig.day]}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={dayConfig.open_time}
                          disabled={!dayConfig.is_open}
                          onChange={(e) => {
                            const next = [...scheduleSettings.business_hours];
                            next[idx] = { ...dayConfig, open_time: e.target.value };
                            setScheduleSettings({ ...scheduleSettings, business_hours: next });
                          }}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-sm"
                        />
                        <span className="text-slate-500 text-sm">to</span>
                        <input
                          type="time"
                          value={dayConfig.close_time}
                          disabled={!dayConfig.is_open}
                          onChange={(e) => {
                            const next = [...scheduleSettings.business_hours];
                            next[idx] = { ...dayConfig, close_time: e.target.value };
                            setScheduleSettings({ ...scheduleSettings, business_hours: next });
                          }}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-slate-900 mb-2">Auto-Confirm Services</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {serviceCatalog.map((service) => {
                    const checked = scheduleSettings.auto_confirm_services.includes(service);
                    return (
                      <label key={service} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextAuto = e.target.checked
                              ? [...scheduleSettings.auto_confirm_services, service]
                              : scheduleSettings.auto_confirm_services.filter((item) => item !== service);
                            const nextApproval = scheduleSettings.approval_required_services.filter((item) => item !== service);
                            setScheduleSettings({
                              ...scheduleSettings,
                              auto_confirm_services: nextAuto,
                              approval_required_services: nextApproval,
                            });
                          }}
                        />
                        {service}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-slate-900 mb-2">Advisor Approval Required</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {serviceCatalog.map((service) => {
                    const checked = scheduleSettings.approval_required_services.includes(service);
                    return (
                      <label key={service} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextApproval = e.target.checked
                              ? [...scheduleSettings.approval_required_services, service]
                              : scheduleSettings.approval_required_services.filter((item) => item !== service);
                            const nextAuto = scheduleSettings.auto_confirm_services.filter((item) => item !== service);
                            setScheduleSettings({
                              ...scheduleSettings,
                              approval_required_services: nextApproval,
                              auto_confirm_services: nextAuto,
                            });
                          }}
                        />
                        {service}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Services marked for advisor approval will be saved as pending until a service advisor confirms.
                </p>
              </div>
            </div>
          </div>
          </>
          )}

          {activeTab === 'rewards' && (
          <>
          <div>
            <h4 className="text-base font-semibold text-slate-900 mb-4">Rewards Configuration</h4>

            <div className="space-y-4">
              <div>
                <label htmlFor="points-per-dollar" className="block text-sm font-medium text-slate-700 mb-2">
                  Points Per Dollar Spent
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="points-per-dollar"
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
                    <label htmlFor="bronze-points-min" className="block text-sm font-medium text-slate-700 mb-1">
                      Minimum Points
                    </label>
                    <input
                      id="bronze-points-min"
                      type="number"
                      min="0"
                      value={tierSettings.bronze_points_min}
                      onChange={(e) => setTierSettings({ ...tierSettings, bronze_points_min: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="bronze-multiplier" className="block text-sm font-medium text-slate-700 mb-1">
                      Points Multiplier
                    </label>
                    <input
                      id="bronze-multiplier"
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
                    <label htmlFor="silver-points-min" className="block text-sm font-medium text-slate-700 mb-1">
                      Minimum Points
                    </label>
                    <input
                      id="silver-points-min"
                      type="number"
                      min="0"
                      value={tierSettings.silver_points_min}
                      onChange={(e) => setTierSettings({ ...tierSettings, silver_points_min: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="silver-multiplier" className="block text-sm font-medium text-slate-700 mb-1">
                      Points Multiplier
                    </label>
                    <input
                      id="silver-multiplier"
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
                    <label htmlFor="gold-points-min" className="block text-sm font-medium text-slate-700 mb-1">
                      Minimum Points
                    </label>
                    <input
                      id="gold-points-min"
                      type="number"
                      min="0"
                      value={tierSettings.gold_points_min}
                      onChange={(e) => setTierSettings({ ...tierSettings, gold_points_min: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="gold-multiplier" className="block text-sm font-medium text-slate-700 mb-1">
                      Points Multiplier
                    </label>
                    <input
                      id="gold-multiplier"
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
                    <label htmlFor="platinum-points-min" className="block text-sm font-medium text-slate-700 mb-1">
                      Minimum Points
                    </label>
                    <input
                      id="platinum-points-min"
                      type="number"
                      min="0"
                      value={tierSettings.platinum_points_min}
                      onChange={(e) => setTierSettings({ ...tierSettings, platinum_points_min: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="platinum-multiplier" className="block text-sm font-medium text-slate-700 mb-1">
                      Points Multiplier
                    </label>
                    <input
                      id="platinum-multiplier"
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
          </>
          )}

          {activeTab === 'repair_orders' && (
          <>
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-slate-700" />
              Repair Order Markup Rules (Parts Only)
            </h4>

            {!markupRulesSupported && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                Markup rules will save after the database schema is updated. You can configure them now and re-save later.
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <div>Min Cost</div>
                <div>Max Cost</div>
                <div>Markup %</div>
                <div>Active</div>
              </div>
              {markupRules.length === 0 && (
                <div className="text-sm text-slate-600">No markup rules yet. Add your first range below.</div>
              )}
              {markupRules.map((rule, idx) => (
                <div key={rule.id || idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={rule.min_cost}
                    onChange={(e) => {
                      const next = [...markupRules];
                      next[idx] = { ...rule, min_cost: Number(e.target.value) };
                      setMarkupRules(next);
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={rule.max_cost === null ? '' : rule.max_cost}
                    onChange={(e) => {
                      const next = [...markupRules];
                      const value = e.target.value;
                      next[idx] = { ...rule, max_cost: value === '' ? null : Number(value) };
                      setMarkupRules(next);
                    }}
                    placeholder="No max"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={rule.markup_percent}
                    onChange={(e) => {
                      const next = [...markupRules];
                      next[idx] = { ...rule, markup_percent: Number(e.target.value) };
                      setMarkupRules(next);
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={rule.is_active}
                        onChange={(e) => {
                          const next = [...markupRules];
                          next[idx] = { ...rule, is_active: e.target.checked };
                          setMarkupRules(next);
                        }}
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => setMarkupRules(markupRules.filter((_, ruleIdx) => ruleIdx !== idx))}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMarkupRules([...markupRules, { min_cost: 0, max_cost: null, markup_percent: 0, is_active: true }])}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg"
              >
                Add Markup Rule
              </button>
              <p className="text-xs text-slate-500">
                Set ranges to automatically calculate part pricing from cost.
              </p>
            </div>
          </div>
          </>
          )}
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
