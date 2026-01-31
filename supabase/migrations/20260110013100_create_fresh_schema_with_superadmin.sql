/*
  # Fresh Schema with Super Admin System
  
  This creates a clean multi-tenant auto shop management system with:
  
  1. Super Admins - Platform-level administrators who can:
     - Create and manage shops
     - Add initial admin accounts to shops
     - Have unrestricted access to all data
  
  2. Tables:
     - super_admins: Platform administrators
     - shops: Individual auto shops
     - shop_settings: Branding and configuration per shop
     - customers: Users belonging to shops (includes shop admins)
     - vehicles: Customer vehicles
     - services: Service records
     - reward_items: Redeemable rewards per shop
     - reward_redemptions: Redemption history
     - promotions: Shop promotions
     - customer_promotions: Assigned promotions
     - appointments: Service appointments
  
  3. Security:
     - All tables have RLS enabled
     - Super admins bypass all restrictions
     - Shop admins can only access their shop's data
     - Customers can only access their own data
*/

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'shops'
  ) THEN

-- Super Admins table (platform level)
CREATE TABLE super_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Shops table
CREATE TABLE shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Shop Settings table
CREATE TABLE shop_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE UNIQUE NOT NULL,
  primary_color text DEFAULT '#10b981',
  secondary_color text DEFAULT '#0f172a',
  logo_url text,
  welcome_message text DEFAULT 'Welcome to our rewards program!',
  points_per_dollar integer DEFAULT 10,
  tier_thresholds jsonb DEFAULT '{"silver": 500, "gold": 1000, "platinum": 2500}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

-- Customers table (includes shop admins)
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  is_admin boolean DEFAULT false,
  tier text DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  reward_points integer DEFAULT 0,
  lifetime_spending numeric(10,2) DEFAULT 0,
  is_deactivated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, email)
);

CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_customers_auth_user_id ON customers(auth_user_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Vehicles table
CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  license_plate text,
  vin text,
  color text,
  notes text,
  picture_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_shop_id ON vehicles(shop_id);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Services table
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  service_type text NOT NULL,
  description text,
  amount numeric(10,2) NOT NULL,
  points_earned integer DEFAULT 0,
  service_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_services_customer_id ON services(customer_id);
CREATE INDEX idx_services_shop_id ON services(shop_id);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Reward Items table
CREATE TABLE reward_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  points_required integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reward_items_shop_id ON reward_items(shop_id);

ALTER TABLE reward_items ENABLE ROW LEVEL SECURITY;

-- Reward Redemptions table
CREATE TABLE reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  reward_item_id uuid REFERENCES reward_items(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  points_spent integer NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_reward_redemptions_customer_id ON reward_redemptions(customer_id);
CREATE INDEX idx_reward_redemptions_shop_id ON reward_redemptions(shop_id);

ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Promotions table
CREATE TABLE promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  discount_type text CHECK (discount_type IN ('percentage', 'fixed', 'points_multiplier')),
  discount_value numeric(10,2),
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_promotions_shop_id ON promotions(shop_id);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Customer Promotions table
CREATE TABLE customer_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  promotion_id uuid REFERENCES promotions(id) ON DELETE CASCADE NOT NULL,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  is_used boolean DEFAULT false,
  used_at timestamptz,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, promotion_id)
);

CREATE INDEX idx_customer_promotions_customer_id ON customer_promotions(customer_id);
CREATE INDEX idx_customer_promotions_shop_id ON customer_promotions(shop_id);

ALTER TABLE customer_promotions ENABLE ROW LEVEL SECURITY;

-- Appointments table
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE NOT NULL,
  service_type text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX idx_appointments_shop_id ON appointments(shop_id);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS (all SECURITY DEFINER)
-- ============================================

-- Check if current user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE id = auth.uid()
  );
$$;

-- Get the shop_id for the current authenticated user (from customers table)
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id FROM customers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Check if current user is a shop admin
CREATE OR REPLACE FUNCTION is_shop_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM customers 
    WHERE auth_user_id = auth.uid() AND is_admin = true
  );
$$;

-- Check if current user is admin of a specific shop
CREATE OR REPLACE FUNCTION is_admin_of_shop(check_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM customers 
    WHERE auth_user_id = auth.uid() 
    AND is_admin = true 
    AND shop_id = check_shop_id
  );
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Super Admins: only super admins can see other super admins
CREATE POLICY "Super admins can view all super admins"
  ON super_admins FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Shops policies
CREATE POLICY "Super admins can do anything with shops"
  ON shops FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can view their shop"
  ON shops FOR SELECT
  TO authenticated
  USING (id = get_user_shop_id());

CREATE POLICY "Public can view active shops"
  ON shops FOR SELECT
  TO anon
  USING (is_active = true);

-- Shop Settings policies
CREATE POLICY "Super admins can do anything with shop settings"
  ON shop_settings FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their settings"
  ON shop_settings FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Anyone can view shop settings for branding"
  ON shop_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Customers policies
CREATE POLICY "Super admins can do anything with customers"
  ON customers FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop customers"
  ON customers FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can view their own customer record"
  ON customers FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own customer record"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Vehicles policies
CREATE POLICY "Super admins can do anything with vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can manage their own vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

-- Services policies
CREATE POLICY "Super admins can do anything with services"
  ON services FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop services"
  ON services FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can view their own services"
  ON services FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

-- Reward Items policies
CREATE POLICY "Super admins can do anything with reward items"
  ON reward_items FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop reward items"
  ON reward_items FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can view active reward items in their shop"
  ON reward_items FOR SELECT
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_active = true);

-- Reward Redemptions policies
CREATE POLICY "Super admins can do anything with redemptions"
  ON reward_redemptions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop redemptions"
  ON reward_redemptions FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can view and create their own redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create redemptions"
  ON reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

-- Promotions policies
CREATE POLICY "Super admins can do anything with promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can view active promotions in their shop"
  ON promotions FOR SELECT
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_active = true);

-- Customer Promotions policies
CREATE POLICY "Super admins can do anything with customer promotions"
  ON customer_promotions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop customer promotions"
  ON customer_promotions FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can view their own promotions"
  ON customer_promotions FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

-- Appointments policies
CREATE POLICY "Super admins can do anything with appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can manage their own appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================

-- Update customer points and lifetime spending when service is added
CREATE OR REPLACE FUNCTION update_customer_on_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customers
  SET 
    reward_points = reward_points + NEW.points_earned,
    lifetime_spending = lifetime_spending + NEW.amount,
    updated_at = now()
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_customer_on_service
  AFTER INSERT ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_on_service();

-- Update tier based on points
CREATE OR REPLACE FUNCTION update_customer_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thresholds jsonb;
  silver_threshold integer;
  gold_threshold integer;
  platinum_threshold integer;
BEGIN
  SELECT COALESCE(tier_thresholds, '{"silver": 500, "gold": 1000, "platinum": 2500}')
  INTO thresholds
  FROM shop_settings
  WHERE shop_id = NEW.shop_id;
  
  silver_threshold := COALESCE((thresholds->>'silver')::integer, 500);
  gold_threshold := COALESCE((thresholds->>'gold')::integer, 1000);
  platinum_threshold := COALESCE((thresholds->>'platinum')::integer, 2500);
  
  IF NEW.reward_points >= platinum_threshold THEN
    NEW.tier := 'platinum';
  ELSIF NEW.reward_points >= gold_threshold THEN
    NEW.tier := 'gold';
  ELSIF NEW.reward_points >= silver_threshold THEN
    NEW.tier := 'silver';
  ELSE
    NEW.tier := 'bronze';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_customer_tier
  BEFORE UPDATE OF reward_points ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_tier();

-- Process reward redemption
CREATE OR REPLACE FUNCTION process_reward_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE customers
    SET reward_points = reward_points - NEW.points_spent,
        updated_at = now()
    WHERE id = NEW.customer_id;
    
    NEW.processed_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_process_reward_redemption
  BEFORE UPDATE ON reward_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION process_reward_redemption();

-- Auto-create shop_settings when shop is created
CREATE OR REPLACE FUNCTION create_shop_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO shop_settings (shop_id)
  VALUES (NEW.id)
  ON CONFLICT (shop_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_shop_settings
  AFTER INSERT ON shops
  FOR EACH ROW
  EXECUTE FUNCTION create_shop_settings();

  END IF;
END $do$;
