
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
      admins: {
        Row: {
          id: string;
          auth_user_id: string;
          shop_id: string | null;
          email: string;
          full_name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          shop_id?: string | null;
          email: string;
          full_name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          shop_id?: string | null;
          email?: string;
          full_name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
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
          shop_logo_url: string | null;
          welcome_message: string;
          points_per_dollar: number;
          bronze_points_min: number;
          bronze_multiplier: number;
          silver_points_min: number;
          silver_multiplier: number;
          gold_points_min: number;
          gold_multiplier: number;
          platinum_points_min: number;
          platinum_multiplier: number;
          business_hours?: any | null;
          appointment_duration_minutes?: number | null;
          lead_time_minutes?: number | null;
          bay_count?: number | null;
          tech_count?: number | null;
          timezone?: string | null;
          auto_confirm_services?: string[] | null;
          approval_required_services?: string[] | null;
          tax_rate?: number | null;
          taxable_item_types?: string[] | null;
          allow_negative_stock?: boolean | null;
          sms_monthly_allowance?: number | null;
          sms_allow_overage?: boolean | null;
          sms_overage_rate?: number | null;
          email_from?: string | null;
          sms_enabled?: boolean | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          primary_color?: string;
          secondary_color?: string;
          shop_logo_url?: string | null;
          welcome_message?: string;
          points_per_dollar?: number;
          bronze_points_min?: number;
          bronze_multiplier?: number;
          silver_points_min?: number;
          silver_multiplier?: number;
          gold_points_min?: number;
          gold_multiplier?: number;
          platinum_points_min?: number;
          platinum_multiplier?: number;
          business_hours?: any | null;
          appointment_duration_minutes?: number | null;
          lead_time_minutes?: number | null;
          bay_count?: number | null;
          tech_count?: number | null;
          timezone?: string | null;
          auto_confirm_services?: string[] | null;
          approval_required_services?: string[] | null;
          tax_rate?: number | null;
          taxable_item_types?: string[] | null;
          allow_negative_stock?: boolean | null;
          sms_monthly_allowance?: number | null;
          sms_allow_overage?: boolean | null;
          sms_overage_rate?: number | null;
          email_from?: string | null;
          sms_enabled?: boolean | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          primary_color?: string;
          secondary_color?: string;
          shop_logo_url?: string | null;
          welcome_message?: string;
          points_per_dollar?: number;
          bronze_points_min?: number;
          bronze_multiplier?: number;
          silver_points_min?: number;
          silver_multiplier?: number;
          gold_points_min?: number;
          gold_multiplier?: number;
          platinum_points_min?: number;
          platinum_multiplier?: number;
          business_hours?: any | null;
          appointment_duration_minutes?: number | null;
          lead_time_minutes?: number | null;
          bay_count?: number | null;
          tech_count?: number | null;
          timezone?: string | null;
          auto_confirm_services?: string[] | null;
          approval_required_services?: string[] | null;
          tax_rate?: number | null;
          taxable_item_types?: string[] | null;
          allow_negative_stock?: boolean | null;
          sms_monthly_allowance?: number | null;
          sms_allow_overage?: boolean | null;
          sms_overage_rate?: number | null;
          email_from?: string | null;
          sms_enabled?: boolean | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shop_locations: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          timezone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          timezone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          timezone?: string | null;
          is_active?: boolean;
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
          lifetime_spending?: number | null;
          total_lifetime_spending?: number | null;
          total_spent?: number | null;
          has_account: boolean;
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
          lifetime_spending?: number | null;
          total_lifetime_spending?: number | null;
          total_spent?: number | null;
          has_account?: boolean;
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
          lifetime_spending?: number | null;
          total_lifetime_spending?: number | null;
          total_spent?: number | null;
          has_account?: boolean;
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
          shop_id: string;
          make: string;
          model: string;
          year: number;
          license_plate?: string | null;
          vin?: string | null;
          color?: string | null;
          notes?: string | null;
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
          shop_id?: string;
          make?: string;
          model?: string;
          year?: number;
          license_plate?: string | null;
          vin?: string | null;
          color?: string | null;
          notes?: string | null;
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
          points_required?: number | null;
          points_cost?: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          description?: string | null;
          points_required?: number | null;
          points_cost?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          description?: string | null;
          points_required?: number | null;
          points_cost?: number | null;
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
          is_read?: boolean | null;
          read_at?: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          promotion_id: string;
          shop_id: string;
          is_used?: boolean;
          used_at?: string | null;
          assigned_at?: string;
          is_read?: boolean | null;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          customer_id?: string;
          promotion_id?: string;
          shop_id?: string;
          is_used?: boolean;
          used_at?: string | null;
          assigned_at?: string;
          is_read?: boolean | null;
          read_at?: string | null;
        };
      };
      appointments: {
        Row: {
          id: string;
          customer_id: string;
          vehicle_id: string | null;
          shop_id: string;
          location_id?: string | null;
          appointment_type_id?: string | null;
          duration_minutes?: number | null;
          resource_id?: string | null;
          service_type: string;
          scheduled_date: string;
          scheduled_time: string;
          status: string;
          notes: string | null;
          description: string | null;
          admin_notes: string | null;
          cancelled_reason: string | null;
          cancellation_type: 'cancelled' | 'no-show' | null;
          confirmed_by: string | null;
          confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          vehicle_id?: string | null;
          shop_id: string;
          location_id?: string | null;
          appointment_type_id?: string | null;
          duration_minutes?: number | null;
          resource_id?: string | null;
          service_type: string;
          scheduled_date: string;
          scheduled_time: string;
          status?: string;
          notes?: string | null;
          description?: string | null;
          admin_notes?: string | null;
          cancelled_reason?: string | null;
          cancellation_type?: 'cancelled' | 'no-show' | null;
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          vehicle_id?: string | null;
          shop_id?: string;
          location_id?: string | null;
          appointment_type_id?: string | null;
          duration_minutes?: number | null;
          resource_id?: string | null;
          service_type?: string;
          scheduled_date?: string;
          scheduled_time?: string;
          status?: string;
          notes?: string | null;
          description?: string | null;
          admin_notes?: string | null;
          cancelled_reason?: string | null;
          cancellation_type?: 'cancelled' | 'no-show' | null;
          confirmed_by?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      appointment_types: {
        Row: {
          id: string;
          shop_id: string;
          location_id: string | null;
          name: string;
          description: string | null;
          duration_minutes: number;
          buffer_minutes: number;
          capacity_per_slot: number;
          color: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          location_id?: string | null;
          name: string;
          description?: string | null;
          duration_minutes?: number;
          buffer_minutes?: number;
          capacity_per_slot?: number;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          location_id?: string | null;
          name?: string;
          description?: string | null;
          duration_minutes?: number;
          buffer_minutes?: number;
          capacity_per_slot?: number;
          color?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      appointment_resources: {
        Row: {
          id: string;
          shop_id: string;
          location_id: string;
          name: string;
          resource_type: 'bay' | 'tech';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          location_id: string;
          name: string;
          resource_type: 'bay' | 'tech';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          location_id?: string;
          name?: string;
          resource_type?: 'bay' | 'tech';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      appointment_assignments: {
        Row: {
          id: string;
          appointment_id: string;
          resource_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          resource_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          resource_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
      };
      appointment_capacity_rules: {
        Row: {
          id: string;
          shop_id: string;
          location_id: string | null;
          appointment_type_id: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          capacity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          location_id?: string | null;
          appointment_type_id?: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          capacity: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          location_id?: string | null;
          appointment_type_id?: string | null;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          capacity?: number;
          created_at?: string;
        };
      };
      appointment_reminders: {
        Row: {
          id: string;
          appointment_id: string;
          channel: 'app' | 'email' | 'sms';
          scheduled_at: string;
          sent_at: string | null;
          status: 'pending' | 'sent' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          channel: 'app' | 'email' | 'sms';
          scheduled_at: string;
          sent_at?: string | null;
          status?: 'pending' | 'sent' | 'failed';
          created_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          channel?: 'app' | 'email' | 'sms';
          scheduled_at?: string;
          sent_at?: string | null;
          status?: 'pending' | 'sent' | 'failed';
          created_at?: string;
        };
      };
      repair_orders: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          vehicle_id: string | null;
          appointment_id: string | null;
          status: 'draft' | 'awaiting_approval' | 'approved' | 'declined' | 'closed';
          ro_number: string;
          customer_notes: string | null;
          internal_notes: string | null;
          labor_total: number;
          parts_total: number;
          fees_total: number;
          tax_total: number;
          grand_total: number;
          created_at: string;
          updated_at: string;
          approved_at: string | null;
          closed_at: string | null;
          approved_by?: string | null;
          customer_response_by?: string | null;
          customer_approved_at?: string | null;
          customer_declined_at?: string | null;
          customer_notified_at?: string | null;
          admin_notified_at?: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id: string;
          vehicle_id?: string | null;
          appointment_id?: string | null;
          status?: 'draft' | 'awaiting_approval' | 'approved' | 'declined' | 'closed';
          ro_number: string;
          customer_notes?: string | null;
          internal_notes?: string | null;
          labor_total?: number;
          parts_total?: number;
          fees_total?: number;
          tax_total?: number;
          grand_total?: number;
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          closed_at?: string | null;
          approved_by?: string | null;
          customer_response_by?: string | null;
          customer_approved_at?: string | null;
          customer_declined_at?: string | null;
          customer_notified_at?: string | null;
          admin_notified_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string;
          vehicle_id?: string | null;
          appointment_id?: string | null;
          status?: 'draft' | 'awaiting_approval' | 'approved' | 'declined' | 'closed';
          ro_number?: string;
          customer_notes?: string | null;
          internal_notes?: string | null;
          labor_total?: number;
          parts_total?: number;
          fees_total?: number;
          tax_total?: number;
          grand_total?: number;
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          closed_at?: string | null;
          approved_by?: string | null;
          customer_response_by?: string | null;
          customer_approved_at?: string | null;
          customer_declined_at?: string | null;
          customer_notified_at?: string | null;
          admin_notified_at?: string | null;
        };
      };
      repair_order_items: {
        Row: {
          id: string;
          repair_order_id: string;
          item_type: 'labor' | 'part' | 'fee';
          description: string;
          quantity: number;
          unit_price: number;
          total: number;
          taxable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          repair_order_id: string;
          item_type: 'labor' | 'part' | 'fee';
          description: string;
          quantity: number;
          unit_price: number;
          total?: number;
          taxable?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          repair_order_id?: string;
          item_type?: 'labor' | 'part' | 'fee';
          description?: string;
          quantity?: number;
          unit_price?: number;
          total?: number;
          taxable?: boolean;
          created_at?: string;
        };
      };
      repair_order_markup_rules: {
        Row: {
          id: string;
          shop_id: string;
          min_cost: number;
          max_cost: number | null;
          markup_percent: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          min_cost?: number;
          max_cost?: number | null;
          markup_percent?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          min_cost?: number;
          max_cost?: number | null;
          markup_percent?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      repair_order_part_reservations: {
        Row: {
          id: string;
          repair_order_id: string;
          repair_order_item_id: string | null;
          part_id: string;
          location_id: string | null;
          quantity: number;
          status: 'reserved' | 'consumed' | 'released';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          repair_order_id: string;
          repair_order_item_id?: string | null;
          part_id: string;
          location_id?: string | null;
          quantity: number;
          status?: 'reserved' | 'consumed' | 'released';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          repair_order_id?: string;
          repair_order_item_id?: string | null;
          part_id?: string;
          location_id?: string | null;
          quantity?: number;
          status?: 'reserved' | 'consumed' | 'released';
          created_at?: string;
          updated_at?: string;
        };
      };
      parts: {
        Row: {
          id: string;
          shop_id: string;
          sku: string | null;
          name: string;
          description: string | null;
          unit_cost: number;
          unit_price: number;
          taxable: boolean;
          reorder_threshold: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          sku?: string | null;
          name: string;
          description?: string | null;
          unit_cost?: number;
          unit_price?: number;
          taxable?: boolean;
          reorder_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          sku?: string | null;
          name?: string;
          description?: string | null;
          unit_cost?: number;
          unit_price?: number;
          taxable?: boolean;
          reorder_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      part_locations: {
        Row: {
          id: string;
          part_id: string;
          location_id: string;
          on_hand: number;
          reserved: number;
          reorder_threshold: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          part_id: string;
          location_id: string;
          on_hand?: number;
          reserved?: number;
          reorder_threshold?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          part_id?: string;
          location_id?: string;
          on_hand?: number;
          reserved?: number;
          reorder_threshold?: number;
          updated_at?: string;
        };
      };
      vendors: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      purchase_orders: {
        Row: {
          id: string;
          shop_id: string;
          vendor_id: string | null;
          location_id: string | null;
          status: 'draft' | 'sent' | 'received' | 'closed' | 'cancelled';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          vendor_id?: string | null;
          location_id?: string | null;
          status?: 'draft' | 'sent' | 'received' | 'closed' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          vendor_id?: string | null;
          location_id?: string | null;
          status?: 'draft' | 'sent' | 'received' | 'closed' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      purchase_order_lines: {
        Row: {
          id: string;
          purchase_order_id: string;
          part_id: string | null;
          quantity: number;
          unit_cost: number;
          received_qty: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          part_id?: string | null;
          quantity?: number;
          unit_cost?: number;
          received_qty?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          part_id?: string | null;
          quantity?: number;
          unit_cost?: number;
          received_qty?: number;
          created_at?: string;
        };
      };
      inventory_transactions: {
        Row: {
          id: string;
          shop_id: string;
          location_id: string | null;
          part_id: string | null;
          transaction_type: 'receive' | 'adjust' | 'reserve' | 'consume' | 'release';
          quantity: number;
          reference_type: 'po' | 'ro' | 'adjustment' | null;
          reference_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          location_id?: string | null;
          part_id?: string | null;
          transaction_type: 'receive' | 'adjust' | 'reserve' | 'consume' | 'release';
          quantity: number;
          reference_type?: 'po' | 'ro' | 'adjustment' | null;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          location_id?: string | null;
          part_id?: string | null;
          transaction_type?: 'receive' | 'adjust' | 'reserve' | 'consume' | 'release';
          quantity?: number;
          reference_type?: 'po' | 'ro' | 'adjustment' | null;
          reference_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      audit_events: {
        Row: {
          id: string;
          shop_id: string;
          actor_auth_user_id: string | null;
          actor_role: string | null;
          event_type: string;
          entity_type: string;
          entity_id: string | null;
          metadata: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          actor_auth_user_id?: string | null;
          actor_role?: string | null;
          event_type: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          actor_auth_user_id?: string | null;
          actor_role?: string | null;
          event_type?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: any | null;
          created_at?: string;
        };
      };
      dvi_templates: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      dvi_template_sections: {
        Row: {
          id: string;
          template_id: string;
          title: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          title: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          title?: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      dvi_template_items: {
        Row: {
          id: string;
          section_id: string;
          title: string;
          description: string | null;
          default_recommendation: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          section_id: string;
          title: string;
          description?: string | null;
          default_recommendation?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          section_id?: string;
          title?: string;
          description?: string | null;
          default_recommendation?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      dvi_reports: {
        Row: {
          id: string;
          shop_id: string;
          repair_order_id: string;
          customer_id: string;
          vehicle_id: string | null;
          template_id: string | null;
          status: 'draft' | 'published';
          created_by: string | null;
          created_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          shop_id: string;
          repair_order_id: string;
          customer_id: string;
          vehicle_id?: string | null;
          template_id?: string | null;
          status?: 'draft' | 'published';
          created_by?: string | null;
          created_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          shop_id?: string;
          repair_order_id?: string;
          customer_id?: string;
          vehicle_id?: string | null;
          template_id?: string | null;
          status?: 'draft' | 'published';
          created_by?: string | null;
          created_at?: string;
          published_at?: string | null;
        };
      };
      dvi_report_items: {
        Row: {
          id: string;
          report_id: string;
          template_item_id: string | null;
          condition: 'green' | 'yellow' | 'red';
          notes: string | null;
          recommendation: string | null;
          repair_order_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          template_item_id?: string | null;
          condition?: 'green' | 'yellow' | 'red';
          notes?: string | null;
          recommendation?: string | null;
          repair_order_item_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          template_item_id?: string | null;
          condition?: 'green' | 'yellow' | 'red';
          notes?: string | null;
          recommendation?: string | null;
          repair_order_item_id?: string | null;
          created_at?: string;
        };
      };
      dvi_item_media: {
        Row: {
          id: string;
          report_item_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_item_id: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_item_id?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
      };
      chat_threads: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string | null;
          repair_order_id: string | null;
          thread_type: 'ro' | 'general' | 'internal';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id?: string | null;
          repair_order_id?: string | null;
          thread_type?: 'ro' | 'general' | 'internal';
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string | null;
          repair_order_id?: string | null;
          thread_type?: 'ro' | 'general' | 'internal';
          created_by?: string | null;
          created_at?: string;
        };
      };
      chat_participants: {
        Row: {
          id: string;
          thread_id: string;
          auth_user_id: string;
          role: 'admin' | 'customer';
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          auth_user_id: string;
          role: 'admin' | 'customer';
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          auth_user_id?: string;
          role?: 'admin' | 'customer';
          is_active?: boolean;
          created_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_auth_user_id: string | null;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_auth_user_id?: string | null;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          sender_auth_user_id?: string | null;
          message?: string;
          created_at?: string;
        };
      };
      chat_attachments: {
        Row: {
          id: string;
          message_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
      };
      outbound_message_log: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string | null;
          channel: 'app' | 'email' | 'sms';
          subject: string | null;
          body: string | null;
          status: string;
          segments: number | null;
          provider_message_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id?: string | null;
          channel: 'app' | 'email' | 'sms';
          subject?: string | null;
          body?: string | null;
          status?: string;
          segments?: number | null;
          provider_message_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string | null;
          channel?: 'app' | 'email' | 'sms';
          subject?: string | null;
          body?: string | null;
          status?: string;
          segments?: number | null;
          provider_message_id?: string | null;
          created_at?: string;
        };
      };
      sms_usage_monthly: {
        Row: {
          id: string;
          shop_id: string;
          month: string;
          outbound_segments: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          month: string;
          outbound_segments?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          month?: string;
          outbound_segments?: number;
          updated_at?: string;
        };
      };
      sms_opt_out: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string;
          status: 'opted_in' | 'opted_out';
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id: string;
          status?: 'opted_in' | 'opted_out';
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          customer_id?: string;
          status?: 'opted_in' | 'opted_out';
          updated_at?: string;
        };
      };
      sms_overage_events: {
        Row: {
          id: string;
          shop_id: string;
          month: string;
          segments_over: number;
          rate_per_segment: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          month: string;
          segments_over?: number;
          rate_per_segment?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          month?: string;
          segments_over?: number;
          rate_per_segment?: number;
          created_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          auth_user_id: string;
          shop_id: string | null;
          user_role: 'admin' | 'customer';
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          shop_id?: string | null;
          user_role: 'admin' | 'customer';
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          shop_id?: string | null;
          user_role?: 'admin' | 'customer';
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type SuperAdmin = Database['public']['Tables']['super_admins']['Row'];
export type Admin = Database['public']['Tables']['admins']['Row'];
export type Shop = Database['public']['Tables']['shops']['Row'];
export type ShopSettings = Database['public']['Tables']['shop_settings']['Row'];
export type ShopLocation = Database['public']['Tables']['shop_locations']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type Service = Database['public']['Tables']['services']['Row'];
export type RewardItem = Database['public']['Tables']['reward_items']['Row'];
export type RewardRedemption = Database['public']['Tables']['reward_redemptions']['Row'];
export type Promotion = Database['public']['Tables']['promotions']['Row'];
export type CustomerPromotion = Database['public']['Tables']['customer_promotions']['Row'];
export type Appointment = Database['public']['Tables']['appointments']['Row'];
export type AppointmentType = Database['public']['Tables']['appointment_types']['Row'];
export type AppointmentResource = Database['public']['Tables']['appointment_resources']['Row'];
export type AppointmentAssignment = Database['public']['Tables']['appointment_assignments']['Row'];
export type AppointmentCapacityRule = Database['public']['Tables']['appointment_capacity_rules']['Row'];
export type AppointmentReminder = Database['public']['Tables']['appointment_reminders']['Row'];
export type RepairOrder = Database['public']['Tables']['repair_orders']['Row'];
export type RepairOrderItem = Database['public']['Tables']['repair_order_items']['Row'];
export type RepairOrderMarkupRule = Database['public']['Tables']['repair_order_markup_rules']['Row'];
export type RepairOrderPartReservation = Database['public']['Tables']['repair_order_part_reservations']['Row'];
export type Vendor = Database['public']['Tables']['vendors']['Row'];
export type Part = Database['public']['Tables']['parts']['Row'];
export type PartLocation = Database['public']['Tables']['part_locations']['Row'];
export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
export type PurchaseOrderLine = Database['public']['Tables']['purchase_order_lines']['Row'];
export type InventoryTransaction = Database['public']['Tables']['inventory_transactions']['Row'];
export type AuditEvent = Database['public']['Tables']['audit_events']['Row'];
export type DviTemplate = Database['public']['Tables']['dvi_templates']['Row'];
export type DviTemplateSection = Database['public']['Tables']['dvi_template_sections']['Row'];
export type DviTemplateItem = Database['public']['Tables']['dvi_template_items']['Row'];
export type DviReport = Database['public']['Tables']['dvi_reports']['Row'];
export type DviReportItem = Database['public']['Tables']['dvi_report_items']['Row'];
export type DviItemMedia = Database['public']['Tables']['dvi_item_media']['Row'];
export type ChatThread = Database['public']['Tables']['chat_threads']['Row'];
export type ChatParticipant = Database['public']['Tables']['chat_participants']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type ChatAttachment = Database['public']['Tables']['chat_attachments']['Row'];
export type OutboundMessageLog = Database['public']['Tables']['outbound_message_log']['Row'];
export type SmsUsageMonthly = Database['public']['Tables']['sms_usage_monthly']['Row'];
export type SmsOptOut = Database['public']['Tables']['sms_opt_out']['Row'];
export type SmsOverageEvent = Database['public']['Tables']['sms_overage_events']['Row'];
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row'];
