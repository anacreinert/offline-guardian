-- Create weighing_records table
CREATE TABLE public.weighing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_plate TEXT NOT NULL,
  driver_name TEXT,
  product TEXT,
  gross_weight DECIMAL(10,2) NOT NULL,
  tare_weight DECIMAL(10,2) NOT NULL,
  net_weight DECIMAL(10,2) NOT NULL,
  origin TEXT,
  destination TEXT,
  notes TEXT,
  created_offline BOOLEAN DEFAULT false,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weighing_records ENABLE ROW LEVEL SECURITY;

-- Operators can view and create their own records
CREATE POLICY "Users can view their own records"
ON public.weighing_records FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own records"
ON public.weighing_records FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own records"
ON public.weighing_records FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Gestors and Admins can view all records
CREATE POLICY "Gestors and Admins can view all records"
ON public.weighing_records FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'gestor')
);

-- Trigger for updated_at
CREATE TRIGGER update_weighing_records_updated_at
  BEFORE UPDATE ON public.weighing_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for weighing_records
ALTER PUBLICATION supabase_realtime ADD TABLE public.weighing_records;