export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          total_spent: number;
          reward_points: number;
          is_admin: boolean;
          has_account: boolean;
          is_deactivated: boolean;
          tier: string;
          total_lifetime_spending: number;
          tier_multiplier: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          phone?: string | null;
          total_spent?: number;
          reward_points?: number;
          is_admin?: boolean;
          has_account?: boolean;
          is_deactivated?: boolean;
          tier?: string;
          total_lifetime_spending?: number;
          tier_multiplier?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string | null;
          total_spent?: number;
          reward_points?: number;
          is_admin?: boolean;
          has_account?: boolean;
          is_deactivated?: boolean;
          tier?: string;
          total_lifetime_spending?: number;
          tier_multiplier?: number;
          created_at?: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          customer_id: string;
          make: string;
          model: string;
          year: number;
          vin: string | null;
          license_plate: string | null;
          color: string | null;
          mileage: number;
          picture_url: string | null;
          current_mileage: number;
          last_service_date: string | null;
          last_service_mileage: number | null;
          next_service_due_date: string | null;
          next_service_due_mileage: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          make: string;
          model: string;
          year: number;
          vin?: string | null;
          license_plate?: string | null;
          color?: string | null;
          mileage?: number;
          picture_url?: string | null;
          current_mileage?: number;
          last_service_date?: string | null;
          last_service_mileage?: number | null;
          next_service_due_date?: string | null;
          next_service_due_mileage?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          make?: string;
          model?: string;
          year?: number;
          vin?: string | null;
          license_plate?: string | null;
          color?: string | null;
          mileage?: number;
          picture_url?: string | null;
          current_mileage?: number;
          last_service_date?: string | null;
          last_service_mileage?: number | null;
          next_service_due_date?: string | null;
          next_service_due_mileage?: number | null;
          created_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          vehicle_id: string;
          customer_id: string;
          service_date: string;
          description: string;
          amount: number;
          points_earned: number;
          mileage_at_service: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          customer_id: string;
          service_date?: string;
          description: string;
          amount: number;
          points_earned?: number;
          mileage_at_service?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          customer_id?: string;
          service_date?: string;
          description?: string;
          amount?: number;
          points_earned?: number;
          mileage_at_service?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      reward_items: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          points_cost: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          points_cost: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          points_cost?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      reward_redemptions: {
        Row: {
          id: string;
          customer_id: string;
          reward_item_id: string;
          points_spent: number;
          redeemed_at: string;
          status: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          reward_item_id: string;
          points_spent: number;
          redeemed_at?: string;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          reward_item_id?: string;
          points_spent?: number;
          redeemed_at?: string;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      shop_settings: {
        Row: {
          id: string;
          points_per_dollar: number;
          bronze_points_min: number;
          bronze_multiplier: number;
          silver_points_min: number;
          silver_multiplier: number;
          gold_points_min: number;
          gold_multiplier: number;
          platinum_points_min: number;
          platinum_multiplier: number;
          shop_logo_url: string | null;
          primary_color: string;
          secondary_color: string;
          accent_color: string;
          header_text: string;
          welcome_message: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          points_per_dollar?: number;
          bronze_points_min?: number;
          bronze_multiplier?: number;
          silver_points_min?: number;
          silver_multiplier?: number;
          gold_points_min?: number;
          gold_multiplier?: number;
          platinum_points_min?: number;
          platinum_multiplier?: number;
          shop_logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          accent_color?: string;
          header_text?: string;
          welcome_message?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          points_per_dollar?: number;
          bronze_points_min?: number;
          bronze_multiplier?: number;
          silver_points_min?: number;
          silver_multiplier?: number;
          gold_points_min?: number;
          gold_multiplier?: number;
          platinum_points_min?: number;
          platinum_multiplier?: number;
          shop_logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          accent_color?: string;
          header_text?: string;
          welcome_message?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      promotions: {
        Row: {
          id: string;
          title: string;
          description: string;
          discount_type: 'percentage' | 'fixed_amount' | 'points_bonus' | 'free_service';
          discount_value: number;
          promo_code: string | null;
          valid_from: string;
          valid_until: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          discount_type?: 'percentage' | 'fixed_amount' | 'points_bonus' | 'free_service';
          discount_value?: number;
          promo_code?: string | null;
          valid_from?: string;
          valid_until: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          discount_type?: 'percentage' | 'fixed_amount' | 'points_bonus' | 'free_service';
          discount_value?: number;
          promo_code?: string | null;
          valid_from?: string;
          valid_until?: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      customer_promotions: {
        Row: {
          id: string;
          customer_id: string;
          promotion_id: string;
          is_read: boolean;
          is_used: boolean;
          sent_at: string;
          read_at: string | null;
          used_at: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          promotion_id: string;
          is_read?: boolean;
          is_used?: boolean;
          sent_at?: string;
          read_at?: string | null;
          used_at?: string | null;
        };
        Update: {
          id?: string;
          customer_id?: string;
          promotion_id?: string;
          is_read?: boolean;
          is_used?: boolean;
          sent_at?: string;
          read_at?: string | null;
          used_at?: string | null;
        };
      };
      appointments: {
        Row: {
          id: string;
          customer_id: string;
          vehicle_id: string | null;
          requested_date: string;
          requested_time: string;
          service_type: string;
          description: string | null;
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
          admin_notes: string | null;
          confirmed_by: string | null;
          confirmed_at: string | null;
          cancelled_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          vehicle_id?: string | null;
          requested_date: string;
          requested_time: string;
          service_type: string;
          description?: string | null;
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
          admin_notes?: string | null;
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          vehicle_id?: string | null;
          requested_date?: string;
          requested_time?: string;
          service_type?: string;
          description?: string | null;
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
          admin_notes?: string | null;
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type Customer = Database['public']['Tables']['customers']['Row'];
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type Service = Database['public']['Tables']['services']['Row'];
export type RewardItem = Database['public']['Tables']['reward_items']['Row'];
export type RewardRedemption = Database['public']['Tables']['reward_redemptions']['Row'];
export type ShopSettings = Database['public']['Tables']['shop_settings']['Row'];
export type Promotion = Database['public']['Tables']['promotions']['Row'];
export type CustomerPromotion = Database['public']['Tables']['customer_promotions']['Row'];
export type Appointment = Database['public']['Tables']['appointments']['Row'];
