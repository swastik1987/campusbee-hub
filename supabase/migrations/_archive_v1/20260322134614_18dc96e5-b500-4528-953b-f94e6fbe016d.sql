
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) UNIQUE,
  mobile_number VARCHAR(15) UNIQUE,
  full_name VARCHAR(100) NOT NULL DEFAULT '',
  email VARCHAR(255),
  avatar_url TEXT,
  is_provider BOOLEAN DEFAULT false,
  is_apartment_admin BOOLEAN DEFAULT false,
  is_platform_admin BOOLEAN DEFAULT false,
  last_active_persona VARCHAR(20) DEFAULT 'seeker' CHECK (last_active_persona IN ('seeker', 'provider', 'apartment_admin', 'platform_admin')),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = auth_id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = auth_id);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.apartment_complexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  city VARCHAR(100) NOT NULL,
  locality VARCHAR(200) NOT NULL,
  full_address TEXT,
  pin_code VARCHAR(10),
  total_units INTEGER,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  registered_by UUID REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.apartment_complexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved apartments" ON public.apartment_complexes FOR SELECT USING (
  status = 'approved' OR registered_by = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

CREATE TRIGGER update_apartment_complexes_updated_at BEFORE UPDATE ON public.apartment_complexes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
