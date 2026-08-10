-- STEP 1: insert tenants
INSERT INTO public.site_tenants (company_id, site_id, unit_ref, tenant_name, status)
SELECT * FROM (VALUES
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit T04 - Void Service Charge','SMAA Developments Limited','vacant'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Plot A Throckmorton Trials & Ind Estate','Ross Geoffrey Archer','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'T05-T05 Garages & Open Storage','Vacant to be archived','vacant'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit T11 - Void Service Charge','SMAA Developments Limited','vacant'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit T12 - Void Service Charge','SMAA Developments Limited','vacant'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit T13 Void Service Charge','SMAA Developments Limited','vacant'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit T14','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit T16','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit T28','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit T29','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit R.08','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit T06 - Void Service Charge','SMAA Developments Limited','vacant'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit R.10','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit H.05','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'T.07 - Plot F Throckmorton Trials & Ind Est','Rapid Retail Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'T.08 Plot I','Matt Dennis t/a','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'T.09 Land & Building','Paul J & Ryan J Tolley','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'T10. Plot L','Now Storage Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'T15-T15 - Land','SLC Enterprises Limited t/a','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit 18a','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit 18b','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'T19. Land','Pegasus (lease awaiting completion)','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'S.02 Land Throuckmorton Airfield','Dept for Levelling Up','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'S.05 Part Central Airfield Lan','Zephir Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'S.06 Land','Sec of State for Environment','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'H.01 Hangars 1 & 2 & Land','Cazoo Properties Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'H.02','Cazoo Properties Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'H.03 Hangar 3 & External Areas','Malvern Optical','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'Unit H.04','Malvern Optical','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'G10. Old Sewage Farm','Vacant','vacant'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'B.01 Eastern Runways & Western Parcel','Hudson Kapel Fleet Solutions','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'THRO.41 Various Pieces Land','SMAA Developments Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'R.01 Land adjoining Bld 7 & Hangar 5','Cazoo Properties Limited','active'),
  ('4bab41dd-f6a9-4407-983b-d42d32ea1432'::uuid,'c590462e-1447-40df-97a4-c02e64fd3281'::uuid,'R.01 Cap','SMAA Developments Limited','active')
) AS v(company_id,site_id,unit_ref,tenant_name,status)
WHERE NOT EXISTS (SELECT 1 FROM public.site_tenants t WHERE t.site_id=v.site_id AND t.unit_ref=v.unit_ref);

-- STEP 2: insert contacts
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 1, 'Ross Archer', '07970 920659', NULL, NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='Plot A Throckmorton Trials & Ind Estate'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='Plot A Throckmorton Trials & Ind Estate' AND c.position=1);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 2, 'Darren Archer', '07583 742369', NULL, NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='Plot A Throckmorton Trials & Ind Estate'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='Plot A Throckmorton Trials & Ind Estate' AND c.position=2);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 1, 'Callum MacDonald', '07792 517406', 'callum@rapidretail.co.uk', NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='T.07 - Plot F Throckmorton Trials & Ind Est'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='T.07 - Plot F Throckmorton Trials & Ind Est' AND c.position=1);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 2, 'John Crook', '07969 272957', 'john@rapidretail.co.uk', NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='T.07 - Plot F Throckmorton Trials & Ind Est'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='T.07 - Plot F Throckmorton Trials & Ind Est' AND c.position=2);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 1, 'Paul Tolley', '07973 558250', NULL, NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='T.09 Land & Building'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='T.09 Land & Building' AND c.position=1);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 2, 'Joe Sharkey', '07878 693906', NULL, NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='T.09 Land & Building'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='T.09 Land & Building' AND c.position=2);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 3, 'Office', '01386 462554', NULL, 'office', NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='T.09 Land & Building'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='T.09 Land & Building' AND c.position=3);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 1, 'Jonathan', '07947 168447', NULL, 'out of hours', NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='T10. Plot L'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='T10. Plot L' AND c.position=1);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 2, 'Cotswold Security', '03300 101086', NULL, 'out of hours', NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='T10. Plot L'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='T10. Plot L' AND c.position=2);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 3, 'Becky (NS Office)', '07723 013905', NULL, 'guarded hours', NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='T10. Plot L'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='T10. Plot L' AND c.position=3);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 4, 'Jonathan', '07947 168447', NULL, 'guarded hours', NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='T10. Plot L'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='T10. Plot L' AND c.position=4);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 1, 'Steve Guest', '07970 111171', NULL, NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='S.06 Land'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='S.06 Land' AND c.position=1);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 2, 'William Gilder Transport', '07795 960540', NULL, NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='S.06 Land'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='S.06 Land' AND c.position=2);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 1, 'James Green', '07777 765347', 'jgreen@malvernoptical.co.uk', NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='H.03 Hangar 3 & External Areas'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='H.03 Hangar 3 & External Areas' AND c.position=1);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 2, 'Andy Turner', '07375 310453', 'ajturner@malvernoptical.co.uk', NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='H.03 Hangar 3 & External Areas'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='H.03 Hangar 3 & External Areas' AND c.position=2);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 3, 'Main office', '01386 553188', NULL, 'office', 'Monitored 0800-1700'
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='H.03 Hangar 3 & External Areas'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='H.03 Hangar 3 & External Areas' AND c.position=3);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 1, 'James Green', '07777 765347', 'jgreen@malvernoptical.co.uk', NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='Unit H.04'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='Unit H.04' AND c.position=1);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 2, 'Andy Turner', '07375 310453', 'ajturner@malvernoptical.co.uk', NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='Unit H.04'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='Unit H.04' AND c.position=2);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 3, 'Main office', '01386 553188', NULL, 'office', 'Monitored 0800-1700'
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='Unit H.04'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='Unit H.04' AND c.position=3);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 1, 'HK Site Security (Eye Witness Protection)', '07399 550313', NULL, NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='B.01 Eastern Runways & Western Parcel'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='B.01 Eastern Runways & Western Parcel' AND c.position=1);
INSERT INTO public.tenant_contacts (tenant_id, position, name, phone, email, label, notes)
SELECT id, 2, 'Sadie Evens (EWP)', '07490 748770', NULL, NULL, NULL
  FROM public.site_tenants WHERE site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND unit_ref='B.01 Eastern Runways & Western Parcel'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_contacts c JOIN public.site_tenants st ON st.id=c.tenant_id WHERE st.site_id='c590462e-1447-40df-97a4-c02e64fd3281' AND st.unit_ref='B.01 Eastern Runways & Western Parcel' AND c.position=2);
