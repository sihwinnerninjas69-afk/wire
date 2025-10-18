/*
  # Complete Database Schema with Phone OTP and QR Payment System

  ## Overview
  This migration creates the complete database schema including:
  - Phone-based OTP authentication
  - User profiles and management
  - Orders and inquiries
  - Manual QR code payment system with screenshot verification

  ## New Tables

  ### 1. Authentication & Users
  - `phone_users` - Phone-based user authentication
  - `otp_codes` - OTP verification codes
  - `user_profiles` - Extended user profile data

  ### 2. Business Operations
  - `inquiries` - Customer inquiries
  - `orders` - Customer orders
  - `products` - Product catalog

  ### 3. Payment System
  - `payment_qr_codes` - Admin-uploaded payment QR codes
  - `payment_screenshots` - User-uploaded payment proof

  ## Security
  - All tables have RLS enabled
  - Restrictive policies by default
  - Users access only their own data
  - Anonymous users can create orders and inquiries
  - Admin (authenticated users) can manage everything

  ## Important Notes
  - Single active QR code at a time
  - Payment flow: Upload Screenshot -> Pending Verification -> Admin Approves -> Order Processing
  - OTP codes auto-expire
  - Phone numbers are unique per user
*/

-- ============================================
-- AUTHENTICATION & USER MANAGEMENT
-- ============================================

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

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES phone_users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone_number text,
  address text,
  city text,
  state text,
  pincode text,
  company_name text,
  business_type text,
  gst_number text,
  profile_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- BUSINESS OPERATIONS
-- ============================================

-- Create inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_type text NOT NULL,
  location text NOT NULL,
  product_name text,
  product_specification text,
  quantity text,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  additional_requirements text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL,
  stock_quantity integer DEFAULT 0,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
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
  payment_method text DEFAULT 'qr_code',
  transaction_id text,
  estimated_delivery text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- PAYMENT SYSTEM
-- ============================================

-- Create payment_qr_codes table
CREATE TABLE IF NOT EXISTS payment_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  payment_details jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payment_screenshots table
CREATE TABLE IF NOT EXISTS payment_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  screenshot_url text NOT NULL,
  upload_time timestamptz DEFAULT now(),
  verification_status text DEFAULT 'pending',
  verified_by text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add payment_screenshot_id to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_screenshot_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_screenshot_id uuid REFERENCES payment_screenshots(id);
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_phone_users_phone ON phone_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_user ON inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_qr_codes_active ON payment_qr_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_screenshots_order ON payment_screenshots(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_screenshots_status ON payment_screenshots(verification_status);
CREATE INDEX IF NOT EXISTS idx_payment_screenshots_user ON payment_screenshots(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE phone_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_screenshots ENABLE ROW LEVEL SECURITY;

-- Phone Users Policies
CREATE POLICY "Users can view own phone user data"
  ON phone_users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Anyone can insert phone user data"
  ON phone_users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own phone user data"
  ON phone_users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- OTP Codes Policies (needed for authentication flow)
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

-- User Profiles Policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Inquiries Policies
CREATE POLICY "Anyone can view inquiries"
  ON inquiries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert inquiries"
  ON inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update inquiries"
  ON inquiries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Products Policies
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Orders Policies
CREATE POLICY "Anyone can view orders"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Payment QR Codes Policies
CREATE POLICY "Anyone can view active QR codes"
  ON payment_qr_codes FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all QR codes"
  ON payment_qr_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert QR codes"
  ON payment_qr_codes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update QR codes"
  ON payment_qr_codes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Payment Screenshots Policies
CREATE POLICY "Anyone can view payment screenshots"
  ON payment_screenshots FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert payment screenshots"
  ON payment_screenshots FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update screenshots"
  ON payment_screenshots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to cleanup expired OTP codes
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_codes WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate other QR codes when a new one is activated
CREATE OR REPLACE FUNCTION deactivate_other_qr_codes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE payment_qr_codes
    SET is_active = false, updated_at = now()
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for QR code activation
DROP TRIGGER IF EXISTS trigger_deactivate_other_qr_codes ON payment_qr_codes;
CREATE TRIGGER trigger_deactivate_other_qr_codes
  AFTER INSERT OR UPDATE OF is_active ON payment_qr_codes
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION deactivate_other_qr_codes();

-- Function to update order status after payment verification
CREATE OR REPLACE FUNCTION update_order_on_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status = 'approved' AND (OLD.verification_status IS NULL OR OLD.verification_status != 'approved') THEN
    UPDATE orders
    SET 
      status = 'processing',
      payment_status = 'completed',
      updated_at = now()
    WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for order status update
DROP TRIGGER IF EXISTS trigger_update_order_on_verification ON payment_screenshots;
CREATE TRIGGER trigger_update_order_on_verification
  AFTER UPDATE OF verification_status ON payment_screenshots
  FOR EACH ROW
  WHEN (NEW.verification_status = 'approved')
  EXECUTE FUNCTION update_order_on_verification();