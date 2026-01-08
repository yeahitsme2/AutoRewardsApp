/*
  # Auto Repair Shop Rewards System Schema

  ## Overview
  Complete database schema for automotive repair shop with customer rewards tracking

  ## New Tables

  ### `customers`
  - `id` (uuid, primary key) - Links to auth.users
  - `email` (text, unique) - Customer email
  - `full_name` (text) - Customer full name
  - `phone` (text) - Contact phone number
  - `total_spent` (numeric) - Lifetime spending total
  - `reward_points` (integer) - Current reward points balance
  - `created_at` (timestamptz) - Account creation timestamp
  - `is_admin` (boolean) - Admin access flag

  ### `vehicles`
  - `id` (uuid, primary key) - Unique vehicle identifier
  - `customer_id` (uuid, foreign key) - Links to customers table
  - `make` (text) - Vehicle manufacturer
  - `model` (text) - Vehicle model
  - `year` (integer) - Vehicle year
  - `vin` (text, unique) - Vehicle identification number
  - `license_plate` (text) - License plate number
  - `color` (text) - Vehicle color
  - `mileage` (integer) - Current mileage
  - `created_at` (timestamptz) - Record creation timestamp

  ### `services`
  - `id` (uuid, primary key) - Unique service identifier
  - `vehicle_id` (uuid, foreign key) - Links to vehicles table
  - `customer_id` (uuid, foreign key) - Links to customers table
  - `service_date` (date) - Date service was performed
  - `description` (text) - Service description
  - `amount` (numeric) - Service cost
  - `points_earned` (integer) - Reward points from this service
  - `mileage_at_service` (integer) - Vehicle mileage at time of service
  - `notes` (text) - Additional service notes
  - `created_at` (timestamptz) - Record creation timestamp
  - `created_by` (uuid) - Admin who created the record

  ## Security

  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Customers can view their own data only
  - Admins can view and modify all data
  - Public cannot access any data without authentication

  ### Important Notes
  1. Points are calculated as $1 spent = 1 point
  2. Admins are identified by the `is_admin` flag in customers table
  3. All timestamps use timezone-aware types
  4. Financial amounts use numeric type for precision
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  total_spent numeric DEFAULT 0,
  reward_points integer DEFAULT 0,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  vin text UNIQUE,
  license_plate text,
  color text,
  mileage integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  points_earned integer DEFAULT 0,
  mileage_at_service integer,
  notes text,
  created_by uuid REFERENCES customers(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Customers table policies
CREATE POLICY "Users can view own customer profile"
  ON customers FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

CREATE POLICY "Users can update own profile"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

CREATE POLICY "Admins can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

-- Vehicles table policies
CREATE POLICY "Users can view own vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Admins can view all vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

CREATE POLICY "Admins can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

CREATE POLICY "Admins can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

CREATE POLICY "Admins can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

-- Services table policies
CREATE POLICY "Users can view own services"
  ON services FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Admins can view all services"
  ON services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

CREATE POLICY "Admins can insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

CREATE POLICY "Admins can update services"
  ON services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

CREATE POLICY "Admins can delete services"
  ON services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_services_customer_id ON services(customer_id);
CREATE INDEX IF NOT EXISTS idx_services_vehicle_id ON services(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_services_service_date ON services(service_date);

-- Function to automatically update customer totals when a service is added
CREATE OR REPLACE FUNCTION update_customer_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total spent and reward points
  UPDATE customers
  SET 
    total_spent = total_spent + NEW.amount,
    reward_points = reward_points + NEW.points_earned
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer totals
CREATE TRIGGER trigger_update_customer_totals
AFTER INSERT ON services
FOR EACH ROW
EXECUTE FUNCTION update_customer_totals();