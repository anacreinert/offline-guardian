-- Add rejection columns to weighing_records
ALTER TABLE public.weighing_records
ADD COLUMN rejected_at timestamp with time zone DEFAULT NULL,
ADD COLUMN rejected_by uuid DEFAULT NULL,
ADD COLUMN rejection_reason text DEFAULT NULL;