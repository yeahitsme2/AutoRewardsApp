import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { useShop } from './ShopContext';

interface BrandSettings {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  welcome_message: string;
  silver_points_min: number;
  gold_points_min: number;
  platinum_points_min: number;
  bronze_multiplier: number;
  silver_multiplier: number;
  gold_multiplier: number;
  platinum_multiplier: number;
  points_per_dollar: number;
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
  silver_points_min: 500,
  gold_points_min: 1000,
  platinum_points_min: 2500,
  bronze_multiplier: 1.0,
  silver_multiplier: 1.25,
  gold_multiplier: 1.5,
  platinum_multiplier: 2.0,
  points_per_dollar: 10,
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
        .select('shop_logo_url, primary_color, secondary_color, welcome_message, silver_points_min, gold_points_min, platinum_points_min, bronze_multiplier, silver_multiplier, gold_multiplier, platinum_multiplier, points_per_dollar')
        .eq('shop_id', shop.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading brand settings:', error);
        applyBrandStyles(defaultBrand);
        return;
      }

      if (data) {
        const settings = {
          logo_url: data.shop_logo_url,
          primary_color: data.primary_color || defaultBrand.primary_color,
          secondary_color: data.secondary_color || defaultBrand.secondary_color,
          welcome_message: data.welcome_message || defaultBrand.welcome_message,
          silver_points_min: data.silver_points_min || defaultBrand.silver_points_min,
          gold_points_min: data.gold_points_min || defaultBrand.gold_points_min,
          platinum_points_min: data.platinum_points_min || defaultBrand.platinum_points_min,
          bronze_multiplier: Number(data.bronze_multiplier) || defaultBrand.bronze_multiplier,
          silver_multiplier: Number(data.silver_multiplier) || defaultBrand.silver_multiplier,
          gold_multiplier: Number(data.gold_multiplier) || defaultBrand.gold_multiplier,
          platinum_multiplier: Number(data.platinum_multiplier) || defaultBrand.platinum_multiplier,
          points_per_dollar: Number(data.points_per_dollar) || defaultBrand.points_per_dollar,
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
