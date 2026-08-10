INSERT INTO public.distribution_recipients (company_id, site_id, name, unit_ref, email, active)
SELECT '4bab41dd-f6a9-4407-983b-d42d32ea1432', 'c590462e-1447-40df-97a4-c02e64fd3281', v.name, v.unit_ref, v.email, true
FROM (VALUES
  ('Ross Geoffrey Archer','Plot A','michelle@archerstransportuk.co.uk'),
  ('Rapid Retail Limited','T.07 - Plot F','maddie@rapidretail.co.uk'),
  ('Rapid Retail Limited','T.07 - Plot F','john@rapidretail.co.uk'),
  ('Rapid Retail Limited','T.07 - Plot F','callum@rapidretail.co.uk'),
  ('Matt Dennis t/a','T.08 Plot I','matt@sandendrivertraining.co.uk'),
  ('Paul J & Ryan J Tolley','T.09','paul@prestigetoilethire.co.uk'),
  ('Paul J & Ryan J Tolley','T.09','info@prestigetoilethire.co.uk'),
  ('Paul J & Ryan J Tolley','T.09','accounts@prestigetoilethire.co.uk'),
  ('Now Storage Limited','T10. Plot L','support@nowstorage.co.uk'),
  ('SLC Enterprises Limited t/a','T15','office@skippyskiphire.com'),
  ('Pegasus (lease awaiting completion)','T19','rebecca.sanderson@wearepegasus.co.uk'),
  ('Sec of State for Environment','S.06','steve@fromevalegroup.com'),
  ('Sec of State for Environment','S.06','nick.musto@wgilder.co.uk'),
  ('Malvern Optical','H.03 Hangar 3','admin@malvernoptical.co.uk'),
  ('Hudson Kapel Fleet Solutions','B.01','jon.halloran@hudsonkapel.com'),
  ('Hudson Kapel Fleet Solutions','B.01','julian.smith@hudsonkapel.com'),
  ('Matt Giles (Litewire Solutions)','Contractor','matt@litewiresolutions.com'),
  ('Robert Corfield (Garden Square)','Contractor','robert.corfield@gardensquare.net'),
  ('David Foster (Risk Secured)','Contractor','david@risksecured.co.uk'),
  ('Harris Lamb','Contractor','julie.sanders@harrislamb.com'),
  ('Harris Lamb','Contractor','ruth.stanton@harrislamb.com'),
  ('Harris Lamb','Contractor','qasim.sadique@harrislamb.com')
) AS v(name, unit_ref, email)
WHERE NOT EXISTS (
  SELECT 1 FROM public.distribution_recipients d
  WHERE d.site_id = 'c590462e-1447-40df-97a4-c02e64fd3281' AND lower(d.email) = lower(v.email)
);
