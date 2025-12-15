-- Add photo_urls column to store photo URLs for audit purposes
ALTER TABLE public.weighing_records 
ADD COLUMN IF NOT EXISTS photo_urls jsonb DEFAULT '{}';

-- Add approval_required flag to track if offline record needs approval before sync
-- (already exists approval workflow with approved_at/approved_by, just need to ensure it works)

COMMENT ON COLUMN public.weighing_records.photo_urls IS 'JSON object storing photo URLs by category: vehiclePlate, tare, product';