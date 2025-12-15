-- Add approval fields to weighing_records
ALTER TABLE public.weighing_records 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Create policy for gestors and admins to update (approve) any records
CREATE POLICY "Gestors and Admins can update all records"
ON public.weighing_records FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'gestor')
);