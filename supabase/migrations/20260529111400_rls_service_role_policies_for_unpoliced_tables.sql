DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'address_history','client_alerts','client_users','company_policies',
    'company_update_comments','company_updates','contract_lines','contract_queries',
    'employment_history','hr_notes','identity_documents','log_comments','log_media',
    'named_patrol_checkpoints','named_patrol_routes','officer_rates','officer_sites',
    'patrol_checkpoints','patrol_sessions','shift_checks','shift_patterns','site_checks',
    'site_codes','site_documents','site_folders','site_instructions','site_playbooks',
    'site_scheduled_tasks','site_standing_checks','vetting_checklist','visitors'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO service_role '
      || 'USING (current_setting(''role'') = ''service_role'') '
      || 'WITH CHECK (current_setting(''role'') = ''service_role'')',
      t || '_service', t
    );
  END LOOP;
END $$;
