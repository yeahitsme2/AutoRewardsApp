export interface Database {
  public: {
    Tables: {
      super_admins: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          created_at?: string;
        };
      };
      shops: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      shop_settings: {
        Row: {
          id: string;
          shop_id: string;
          primary_color: string;
          secondary_color: string;
          logo_url: string | null;
          welcome_message: string;
          points_per_dollar: number;
          tier_thresholds: {
            silver: number;
            gold: number;
            platinum: number;
          };
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          primary_color?: string;
          secondary_color?: string;
          logo_url?: string | null;
          welcome_message?: string;
          points_per_dollar?: number;
          tier_thresholds?: {
            silver: number;
            gold: number;
            platinum: number;
          };
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          primary_color?: string;
          secondary_color?: string;
          logo_url?: string | null;
          welcome_message?: string;
          points_per_dollar?: number;
          tier_thresholds?: {
            silver: number;
            gold: number;
            platinum: number;
          };
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          auth_user_id: string | null;
          shop_id: string;
          email: string;
          full_name: string;
          phone: string | null;
          is_admin: boolean;
          tier: string;
          reward_points: number;
          lifetime_spending: number;
          is_deactivated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          shop_id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          is_admin?: boolean;
          tier?: string;
          reward_points?: number;
          lifetime_spending?: number;
          is_deactivated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          shop_id?: string;
          email?: string;
          full_name?: string;
          phone?: string | null;
          is_admin?: boolean;
          tier?: string;
          reward_points?: number;
          lifetime_spending?: number;
          is_deactivated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          customer_id: string;
          shop_id: string;
          make: string;
          model: string;
          year: number;
          license_plate: string | null;
          vin: string | null;
          color: string | null;
          notes: string | null;
          picture_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          shop_id: string;
          make: string;
          model: string;
          year: number;
          license_plate?: string | null;
          vin?: string | null;
          color?: string | null;
          notes?: string | null;
          picture_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          shop_id?: string;
          make?: string;
          model?: string;
          year?: number;
          license_plate?: string | null;
          vin?: string | null;
          color?: string | null;
          notes?: string | null;
          picture_url?: string | null;
          created_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          customer_id: string;
          vehicle_id: string | null;
          shop_id: string;
          service_type: string;
          description: string | null;
          amount: number;
          points_earned: number;
          service_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          vehicle_id?: string | null;
          shop_id: string;
          service_type: string;
          description?: string | null;
          amount: number;
          points_earned?: number;
          service_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          vehicle_id?: string | null;
          shop_id?: string;
          service_type?: string;
          description?: string | null;
          amount?: number;
          points_earned?: number;
          service_date?: string;
          created_at?: string;
        };
      };
      reward_items: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          description: string | null;
          points_required: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          description?: string | null;
          points_required: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          description?: string | null;
          points_required?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      reward_redemptions: {
        Row: {
          id: string;
          customer_id: string;
          reward_item_id: string | null;
          shop_id: string;
          points_spent: number;
          status: string;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          reward_item_id?: string | null;
          shop_id: string;
          points_spent: number;
          status?: string;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          customer_id?: string;
          reward_item_id?: string | null;
          shop_id?: string;
          points_spent?: number;
          status?: string;
          created_at?: string;
          processed_at?: string | null;
        };
      };
      promotions: {
        Row: {
          id: string;
          shop_id: string;
          title: string;
          description: string | null;
          discount_type: string | null;
          discount_value: number | null;
          valid_from: string;
          valid_until: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          title: string;
          description?: string | null;
          discount_type?: string | null;
          discount_value?: number | null;
          valid_from?: string;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          title?: string;
          description?: string | null;
          discount_type?: string | null;
          discount_value?: number | null;
          valid_from?: string;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      customer_promotions: {
        Row: {
          id: string;
          customer_id: string;
          promotion_id: string;
          shop_id: string;
          is_used: boolean;
          used_at: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          promotion_id: string;
          shop_id: string;
          is_used?: boolean;
          used_at?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          promotion_id?: string;
          shop_id?: string;
          is_used?: boolean;
          used_at?: string | null;
          assigned_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          customer_id: string;
          vehicle_id: string | null;
          shop_id: string;
          service_type: string;
          scheduled_date: string;
          scheduled_time: string;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          vehicle_id?: string | null;
          shop_id: string;
          service_type: string;
          scheduled_date: string;
          scheduled_time: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          vehicle_id?: string | null;
          shop_id?: string;
          service_type?: string;
          scheduled_date?: string;
          scheduled_time?: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type SuperAdmin = Database['public']['Tables']['super_admins']['Row'];
export type Shop = Database['public']['Tables']['shops']['Row'];
export type ShopSettings = Database['public']['Tables']['shop_settings']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type Service = Database['public']['Tables']['services']['Row'];
export type RewardItem = Database['public']['Tables']['reward_items']['Row'];
export type RewardRedemption = Database['public']['Tables']['reward_redemptions']['Row'];
export type Promotion = Database['public']['Tables']['promotions']['Row'];
export type CustomerPromotion = Database['public']['Tables']['customer_promotions']['Row'];
export type Appointment = Database['public']['Tables']['appointments']['Row'];
