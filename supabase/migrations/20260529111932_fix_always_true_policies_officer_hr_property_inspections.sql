-- officer_hr: drop dead auth.uid() policy and always-true service policy, add service_role-only
DROP POLICY IF EXISTS officer_hr_self ON public.officer_hr;
DROP POLICY IF EXISTS officer_hr_service ON public.officer_hr;
CREATE POLICY officer_hr_service ON public.officer_hr
  AS PERMISSIVE FOR ALL TO service_role
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- property_inspections: drop always-true service policy, add service_role-only
DROP POLICY IF EXISTS property_inspections_service ON public.property_inspections;
CREATE POLICY property_inspections_service ON public.property_inspections
  AS PERMISSIVE FOR ALL TO service_role
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');
