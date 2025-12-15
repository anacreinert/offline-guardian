-- Add weight method and estimation fields to weighing_records
ALTER TABLE public.weighing_records 
ADD COLUMN IF NOT EXISTS weight_method TEXT DEFAULT 'scale',
ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_reason TEXT;

-- Add constraint for weight_method values
ALTER TABLE public.weighing_records 
ADD CONSTRAINT weighing_records_weight_method_check 
CHECK (weight_method IN ('scale', 'display_ocr', 'estimated'));