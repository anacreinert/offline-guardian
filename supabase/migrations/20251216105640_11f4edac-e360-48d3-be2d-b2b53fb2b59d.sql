-- Add columns for deletion request workflow
ALTER TABLE public.weighing_records 
ADD COLUMN IF NOT EXISTS deletion_requested boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deletion_reason text,
ADD COLUMN IF NOT EXISTS deletion_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deletion_requested_by uuid;

-- Add index for filtering deletion requests
CREATE INDEX IF NOT EXISTS idx_weighing_records_deletion_requested 
ON public.weighing_records(deletion_requested) 
WHERE deletion_requested = true;