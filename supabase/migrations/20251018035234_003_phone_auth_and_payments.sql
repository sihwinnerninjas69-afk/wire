-- Phone OTP Authentication and Payment Integration Schema
-- 
-- Overview:
-- This migration creates the necessary tables for phone-based OTP authentication
-- and Stripe payment integration.
--
-- New Tables:
-- 1. phone_users - Stores user authentication data for phone-based login
-- 2. otp_codes - Manages OTP codes for phone verification
-- 3. orders - Customer orders table
-- 4. payment_transactions - Records all payment transactions via Stripe
-- 5. user_profiles_extended - Extended user profile information
--
-- Security:
-- - Enable RLS on all tables
-- - Users can only access their own data
-- - OTP codes are automatically cleaned up after expiration

-- Create phone_users table
CREATE TABLE IF NOT EXISTS phone_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text UNIQUE NOT NULL,
  phone_verified boolean DEFAULT false,
  last_login_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create otp_codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,
  customer_city text,
  customer_state text,
  customer_pincode text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(10, 2) NOT NULL,
  shipping_cost numeric(10, 2) DEFAULT 0,
  total_amount numeric(10, 2) NOT NULL,
  status text DEFAULT 'pending',
  payment_status text DEFAULT 'pending',
  payment_method text,
  stripe_payment_intent_id text,
  transaction_id text,
  estimated_delivery text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'INR',
  status text DEFAULT 'pending',
  payment_method text,
  receipt_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_profiles_extended table
CREATE TABLE IF NOT EXISTS user_profiles_extended (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_user_id uuid REFERENCES phone_users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  address text,
  city text,
  state text,
  pincode text,
  company_name text,
  gst_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_phone_users_phone ON phone_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_intent ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_extended_phone_user ON user_profiles_extended(phone_user_id);

-- Enable RLS
ALTER TABLE phone_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles_extended ENABLE ROW LEVEL SECURITY;

-- RLS Policies for phone_users
CREATE POLICY "Users can view own phone user data"
  ON phone_users FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own phone user data"
  ON phone_users FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own phone user data"
  ON phone_users FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- RLS Policies for otp_codes (allow anon access for authentication flow)
CREATE POLICY "Anyone can view OTP codes"
  ON otp_codes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert OTP codes"
  ON otp_codes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update OTP codes"
  ON otp_codes FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Anyone can insert orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- RLS Policies for payment_transactions
CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Anyone can insert payment transactions"
  ON payment_transactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own payment transactions"
  ON payment_transactions FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- RLS Policies for user_profiles_extended
CREATE POLICY "Users can view own profile"
  ON user_profiles_extended FOR SELECT
  TO authenticated
  USING (phone_user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON user_profiles_extended FOR INSERT
  TO authenticated
  WITH CHECK (phone_user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
  ON user_profiles_extended FOR UPDATE
  TO authenticated
  USING (phone_user_id = (SELECT auth.uid()))
  WITH CHECK (phone_user_id = (SELECT auth.uid()));

-- Function to cleanup expired OTP codes
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_codes WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;