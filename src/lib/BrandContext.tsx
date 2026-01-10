import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { useShop } from './ShopContext';

interface BrandSettings {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  welcome_message: string;
}

interface BrandContextType {
  brandSettings: BrandSettings;
  loading: boolean;
  refreshBrand: () => Promise<void>;
}

const defaultBrand: BrandSettings = {
  logo_url: null,
  primary_color: '#10b981',
  secondary_color: '#0f172a',
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
  const { shop } = useShop();
  const [brandSettings, setBrandSettings] = useState<BrandSettings>(defaultBrand);
  const [loading, setLoading] = useState(true);

  const loadBrand = async () => {
    if (!shop?.id) {
      applyBrandStyles(defaultBrand);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('logo_url, primary_color, secondary_color, welcome_message')
        .eq('shop_id', shop.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading brand settings:', error);
        applyBrandStyles(defaultBrand);
        return;
      }

      if (data) {
        const settings = {
          logo_url: data.logo_url,
          primary_color: data.primary_color || defaultBrand.primary_color,
          secondary_color: data.secondary_color || defaultBrand.secondary_color,
          welcome_message: data.welcome_message || defaultBrand.welcome_message,
        };
        setBrandSettings(settings);
        applyBrandStyles(settings);
      } else {
        applyBrandStyles(defaultBrand);
      }
    } catch (error) {
      console.error('Error loading brand settings:', error);
      applyBrandStyles(defaultBrand);
    } finally {
      setLoading(false);
    }
  };

  const applyBrandStyles = (settings: BrandSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', settings.primary_color);
    root.style.setProperty('--brand-secondary', settings.secondary_color);
  };

  useEffect(() => {
    loadBrand();
  }, [shop?.id]);

  return (
    <BrandContext.Provider value={{ brandSettings, loading, refreshBrand: loadBrand }}>
      {children}
    </BrandContext.Provider>
  );
}
