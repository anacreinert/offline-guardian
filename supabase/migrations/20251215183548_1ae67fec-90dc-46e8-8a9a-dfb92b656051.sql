-- Add new columns for the restructured weighing flow
ALTER TABLE public.weighing_records
ADD COLUMN IF NOT EXISTS ticket_number TEXT,
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS harvest TEXT,
ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS scale_number TEXT,
ADD COLUMN IF NOT EXISTS entry_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exit_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Create a function to generate ticket numbers
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_month TEXT;
  seq_num INTEGER;
  new_ticket TEXT;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN ticket_number LIKE year_month || '-%' 
      THEN CAST(SUBSTRING(ticket_number FROM LENGTH(year_month) + 2) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO seq_num
  FROM public.weighing_records
  WHERE ticket_number LIKE year_month || '-%';
  
  new_ticket := year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_ticket;
END;
$$;