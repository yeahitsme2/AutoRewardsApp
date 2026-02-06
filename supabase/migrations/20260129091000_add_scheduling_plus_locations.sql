/*
  # Add scheduling entities + shop locations
*/

CREATE TABLE IF NOT EXISTS shop_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  timezone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_locations_shop_id ON shop_locations(shop_id);
ALTER TABLE shop_locations ENABLE ROW LEVEL SECURITY;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES shop_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_type_id uuid,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS resource_id uuid;

CREATE TABLE IF NOT EXISTS appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  location_id uuid REFERENCES shop_locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30,
  buffer_minutes integer NOT NULL DEFAULT 0,
  capacity_per_slot integer NOT NULL DEFAULT 1,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  location_id uuid REFERENCES shop_locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('bay','tech')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_appointment_type_id_fkey') THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_appointment_type_id_fkey
      FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_resource_id_fkey') THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_resource_id_fkey
      FOREIGN KEY (resource_id) REFERENCES appointment_resources(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS appointment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES appointment_resources(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_capacity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  location_id uuid REFERENCES shop_locations(id) ON DELETE SET NULL,
  appointment_type_id uuid REFERENCES appointment_types(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('app','email','sms')),
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_types_shop_id ON appointment_types(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointment_resources_shop_id ON appointment_resources(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointment_capacity_rules_shop_id ON appointment_capacity_rules(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appt_id ON appointment_reminders(appointment_id);

ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_capacity_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_locations' AND policyname='Admins manage shop locations') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage shop locations"
      ON shop_locations FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = shop_locations.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = shop_locations.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shop_locations' AND policyname='Customers view shop locations') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers view shop locations"
      ON shop_locations FOR SELECT
      TO authenticated
      USING (
        is_active = true
        AND shop_id IN (SELECT shop_id FROM customers WHERE auth_user_id = auth.uid())
      )
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointment_types' AND policyname='Admins manage appointment types') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage appointment types"
      ON appointment_types FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = appointment_types.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = appointment_types.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointment_types' AND policyname='Customers view appointment types') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers view appointment types"
      ON appointment_types FOR SELECT
      TO authenticated
      USING (
        is_active = true
        AND shop_id IN (SELECT shop_id FROM customers WHERE auth_user_id = auth.uid())
      )
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointment_resources' AND policyname='Admins manage appointment resources') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage appointment resources"
      ON appointment_resources FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = appointment_resources.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = appointment_resources.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointment_assignments' AND policyname='Admins manage appointment assignments') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage appointment assignments"
      ON appointment_assignments FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM appointment_resources r
        JOIN admins a ON a.shop_id = r.shop_id
        WHERE r.id = appointment_assignments.resource_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM appointment_resources r
        JOIN admins a ON a.shop_id = r.shop_id
        WHERE r.id = appointment_assignments.resource_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointment_capacity_rules' AND policyname='Admins manage capacity rules') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage capacity rules"
      ON appointment_capacity_rules FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = appointment_capacity_rules.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = appointment_capacity_rules.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointment_reminders' AND policyname='Admins manage appointment reminders') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage appointment reminders"
      ON appointment_reminders FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM appointments ap
        JOIN admins a ON a.shop_id = ap.shop_id
        WHERE ap.id = appointment_reminders.appointment_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM appointments ap
        JOIN admins a ON a.shop_id = ap.shop_id
        WHERE ap.id = appointment_reminders.appointment_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointment_reminders' AND policyname='Customers insert appointment reminders') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers insert appointment reminders"
      ON appointment_reminders FOR INSERT
      TO authenticated
      WITH CHECK (
        appointment_id IN (
          SELECT id FROM appointments
          WHERE customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
        )
      )
    $policy$;
  END IF;
END $$;
