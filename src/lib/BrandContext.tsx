import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';

interface BrandSettings {
  shop_logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  header_text: string;
  welcome_message: string;
}

interface BrandContextType {
  brandSettings: BrandSettings;
  loading: boolean;
  refreshBrand: () => Promise<void>;
}

const defaultBrand: BrandSettings = {
  shop_logo_url: null,
  primary_color: '#10b981',
  secondary_color: '#059669',
  accent_color: '#047857',
  header_text: 'Auto Shop Rewards',
  welcome_message: 'Welcome back',
};

const BrandContext = createContext<BrandContextType>({
  brandSettings: defaultBrand,
  loading: true,
  refreshBrand: async () => {},
});

export function useBrand() {
  return useContext(BrandContext);
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brandSettings, setBrandSettings] = useState<BrandSettings>(defaultBrand);
  const [loading, setLoading] = useState(true);

  const loadBrand = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('shop_logo_url, primary_color, secondary_color, accent_color, header_text, welcome_message')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const settings = {
          shop_logo_url: data.shop_logo_url,
          primary_color: data.primary_color || defaultBrand.primary_color,
          secondary_color: data.secondary_color || defaultBrand.secondary_color,
          accent_color: data.accent_color || defaultBrand.accent_color,
          header_text: data.header_text || defaultBrand.header_text,
          welcome_message: data.welcome_message || defaultBrand.welcome_message,
        };
        setBrandSettings(settings);
        applyBrandStyles(settings);
      }
    } catch (error) {
      console.error('Error loading brand settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyBrandStyles = (settings: BrandSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', settings.primary_color);
    root.style.setProperty('--brand-secondary', settings.secondary_color);
    root.style.setProperty('--brand-accent', settings.accent_color);
  };

  useEffect(() => {
    loadBrand();
  }, []);

  return (
    <BrandContext.Provider value={{ brandSettings, loading, refreshBrand: loadBrand }}>
      {children}
    </BrandContext.Provider>
  );
}
