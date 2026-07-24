-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_slots TEXT[] DEFAULT ARRAY[NULL, NULL, NULL, NULL, NULL]::TEXT[],
  guided_slot_roles BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: users can only read their own settings
CREATE POLICY "Users can view own settings"
  ON public.user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: users can only insert their own settings
CREATE POLICY "Users can insert own settings"
  ON public.user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can only update their own settings
CREATE POLICY "Users can update own settings"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update the updated_at timestamp on every update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add is_whitelisted column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS is_whitelisted BOOLEAN DEFAULT FALSE;

-- Add subscription columns to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lemon_squeezy_subscription_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ DEFAULT NULL;

-- Create secure RPC function to verify password and whitelist the user
CREATE OR REPLACE FUNCTION verify_and_whitelist_user(input_password TEXT)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
    IF input_password = 'Vg5d9Xk3' THEN
        UPDATE public.user_settings 
        SET is_whitelisted = TRUE 
        WHERE user_id = auth.uid();
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;


