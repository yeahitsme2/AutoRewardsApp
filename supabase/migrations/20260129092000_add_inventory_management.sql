/*
  # Add inventory management
*/

ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS allow_negative_stock boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  description text,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT true,
  reorder_threshold integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS part_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES shop_locations(id) ON DELETE CASCADE,
  on_hand numeric(10,2) NOT NULL DEFAULT 0,
  reserved numeric(10,2) NOT NULL DEFAULT 0,
  reorder_threshold integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_id, location_id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  location_id uuid REFERENCES shop_locations(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('draft','sent','received','closed','cancelled')) DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  part_id uuid REFERENCES parts(id) ON DELETE SET NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  received_qty numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  location_id uuid REFERENCES shop_locations(id) ON DELETE SET NULL,
  part_id uuid REFERENCES parts(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('receive','adjust','reserve','consume','release')),
  quantity numeric(10,2) NOT NULL,
  reference_type text CHECK (reference_type IN ('po','ro','adjustment')),
  reference_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_order_part_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id uuid NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  repair_order_item_id uuid REFERENCES repair_order_items(id) ON DELETE SET NULL,
  part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  location_id uuid REFERENCES shop_locations(id) ON DELETE SET NULL,
  quantity numeric(10,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved','consumed','released')) DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_shop_id ON vendors(shop_id);
CREATE INDEX IF NOT EXISTS idx_parts_shop_id ON parts(shop_id);
CREATE INDEX IF NOT EXISTS idx_part_locations_part_id ON part_locations(part_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_shop_id ON purchase_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_shop_id ON inventory_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_ro_part_reservations_ro_id ON repair_order_part_reservations(repair_order_id);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_order_part_reservations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_stock_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allow_negative boolean := false;
  delta_on_hand numeric := 0;
  delta_reserved numeric := 0;
BEGIN
  SELECT COALESCE(shop_settings.allow_negative_stock, false)
    INTO allow_negative
  FROM shop_settings
  WHERE shop_id = NEW.shop_id
  LIMIT 1;

  IF NEW.transaction_type = 'receive' THEN
    delta_on_hand := NEW.quantity;
  ELSIF NEW.transaction_type = 'adjust' THEN
    delta_on_hand := NEW.quantity;
  ELSIF NEW.transaction_type = 'reserve' THEN
    delta_reserved := NEW.quantity;
  ELSIF NEW.transaction_type = 'release' THEN
    delta_reserved := -NEW.quantity;
  ELSIF NEW.transaction_type = 'consume' THEN
    delta_on_hand := -NEW.quantity;
    delta_reserved := -NEW.quantity;
  END IF;

  INSERT INTO part_locations (part_id, location_id, on_hand, reserved)
  VALUES (NEW.part_id, NEW.location_id, delta_on_hand, delta_reserved)
  ON CONFLICT (part_id, location_id)
  DO UPDATE SET
    on_hand = part_locations.on_hand + delta_on_hand,
    reserved = part_locations.reserved + delta_reserved,
    updated_at = now();

  IF NOT allow_negative THEN
    PERFORM 1 FROM part_locations
    WHERE part_id = NEW.part_id
      AND location_id = NEW.location_id
      AND on_hand < 0;
    IF FOUND THEN
      RAISE EXCEPTION 'Negative stock not allowed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_inventory_transactions_update_stock ON inventory_transactions;
CREATE TRIGGER trigger_inventory_transactions_update_stock
AFTER INSERT ON inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION update_stock_from_transaction();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendors' AND policyname='Admins manage vendors') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage vendors"
      ON vendors FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = vendors.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = vendors.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parts' AND policyname='Admins manage parts') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage parts"
      ON parts FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = parts.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = parts.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='part_locations' AND policyname='Admins manage part locations') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage part locations"
      ON part_locations FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM parts p
        JOIN admins a ON a.shop_id = p.shop_id
        WHERE p.id = part_locations.part_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM parts p
        JOIN admins a ON a.shop_id = p.shop_id
        WHERE p.id = part_locations.part_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='purchase_orders' AND policyname='Admins manage purchase orders') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage purchase orders"
      ON purchase_orders FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = purchase_orders.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = purchase_orders.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='purchase_order_lines' AND policyname='Admins manage purchase order lines') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage purchase order lines"
      ON purchase_order_lines FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM purchase_orders po
        JOIN admins a ON a.shop_id = po.shop_id
        WHERE po.id = purchase_order_lines.purchase_order_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM purchase_orders po
        JOIN admins a ON a.shop_id = po.shop_id
        WHERE po.id = purchase_order_lines.purchase_order_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inventory_transactions' AND policyname='Admins manage inventory transactions') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage inventory transactions"
      ON inventory_transactions FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = inventory_transactions.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = inventory_transactions.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='repair_order_part_reservations' AND policyname='Admins manage ro part reservations') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage ro part reservations"
      ON repair_order_part_reservations FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM repair_orders ro
        JOIN admins a ON a.shop_id = ro.shop_id
        WHERE ro.id = repair_order_part_reservations.repair_order_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM repair_orders ro
        JOIN admins a ON a.shop_id = ro.shop_id
        WHERE ro.id = repair_order_part_reservations.repair_order_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;
END $$;
