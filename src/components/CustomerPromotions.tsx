import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Tag, Calendar, Percent, DollarSign, Sparkles, Check, X } from 'lucide-react';
import type { Promotion, CustomerPromotion } from '../types/database';

interface PromotionWithStatus extends Promotion {
  customer_promotion: CustomerPromotion;
}

interface CustomerPromotionWithPromotion extends CustomerPromotion {
  promotion: Promotion | null;
}

export function CustomerPromotions() {
  const { customer } = useAuth();
  const [promotions, setPromotions] = useState<PromotionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) {
      setLoading(false);
      return;
    }

    loadPromotions();
    const interval = setInterval(() => {
      loadPromotions();
    }, 5000);

    return () => clearInterval(interval);
  }, [customer]);

  const loadPromotions = async () => {
    if (!customer) return;

    try {
      const { data: customerPromos, error: cpError } = await supabase
        .from('customer_promotions')
        .select('*, promotion:promotions(*)')
        .eq('customer_id', customer.id);

      if (cpError) throw cpError;

      if (!customerPromos || customerPromos.length === 0) {
        setPromotions([]);
        setLoading(false);
        return;
      }

      const promosWithStatus: PromotionWithStatus[] = (customerPromos as CustomerPromotionWithPromotion[])
        .map((cp) => (cp.promotion ? { ...cp.promotion, customer_promotion: cp } : null))
        .filter((p): p is PromotionWithStatus => p !== null)
        .sort((a, b) =>
          new Date(b.customer_promotion.assigned_at).getTime() -
          new Date(a.customer_promotion.assigned_at).getTime()
        );

      setPromotions(promosWithStatus);
    } catch (error) {
      console.error('Error loading promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsUsed = async (promotion: PromotionWithStatus) => {
    try {
      const { error } = await supabase
        .from('customer_promotions')
        .update({
          is_used: !promotion.customer_promotion.is_used,
          used_at: !promotion.customer_promotion.is_used ? new Date().toISOString() : null,
        })
        .eq('id', promotion.customer_promotion.id);

      if (error) throw error;
      loadPromotions();
    } catch (error) {
      console.error('Error updating promotion:', error);
    }
  };

  const getDiscountIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <Percent className="w-5 h-5" />;
      case 'fixed':
        return <DollarSign className="w-5 h-5" />;
      case 'points_multiplier':
        return <Sparkles className="w-5 h-5" />;
      default:
        return <Tag className="w-5 h-5" />;
    }
  };

  const formatDiscountDisplay = (promo: Promotion) => {
    switch (promo.discount_type) {
      case 'percentage':
        return `${promo.discount_value}% off`;
      case 'fixed':
        return `$${promo.discount_value} off`;
      case 'points_multiplier':
        return `${promo.discount_value}x points multiplier`;
      default:
        return '';
    }
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  if (loading) {
    return <div className="text-slate-600">Loading offers...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Special Offers</h2>
        <p className="text-slate-600">Exclusive promotions just for you</p>
      </div>

      {promotions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Tag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Offers Yet</h3>
          <p className="text-slate-600">
            Special promotions will appear here when available
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promotions.map((promo) => {
            const expired = isExpired(promo.valid_until);
            const used = promo.customer_promotion.is_used;

            return (
              <div
                key={promo.id}
                className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden ${
                  used
                    ? 'border-slate-200 opacity-75'
                    : expired
                    ? 'border-orange-200'
                    : promo.is_active
                    ? 'border-emerald-200'
                    : 'border-slate-200'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          used
                            ? 'bg-slate-100 text-slate-400'
                            : expired
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {getDiscountIcon(promo.discount_type)}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">{promo.title}</h3>
                        <p
                          className={`font-semibold mb-2 ${
                            used ? 'text-slate-500' : expired ? 'text-orange-600' : 'text-emerald-600'
                          }`}
                        >
                          {formatDiscountDisplay(promo)}
                        </p>
                        <p className="text-sm text-slate-700 mb-3">{promo.description}</p>

                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {promo.valid_until
                              ? `${expired ? 'Expired' : 'Valid until'} ${new Date(promo.valid_until).toLocaleDateString()}`
                              : 'No expiration'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {used ? (
                      <div className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-2 rounded-lg font-medium">
                        <Check className="w-5 h-5" />
                        Used
                      </div>
                    ) : expired ? (
                      <div className="flex-1 flex items-center justify-center gap-2 bg-orange-100 text-orange-700 py-2 rounded-lg font-medium">
                        <X className="w-5 h-5" />
                        Expired
                      </div>
                    ) : (
                      <button
                        onClick={() => handleMarkAsUsed(promo)}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-medium transition-colors"
                      >
                        Mark as Used
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
