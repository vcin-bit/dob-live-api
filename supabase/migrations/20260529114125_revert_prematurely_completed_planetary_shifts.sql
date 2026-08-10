DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.shifts
   WHERE id IN ('9b98f7d6-b30d-4e8c-a7dd-75c1503b8a7c','e4899cca-adc1-4a0d-bfab-901a668853b8','ffc11ff7-72e2-443d-91dc-1bb79785b50d')
     AND status = 'COMPLETED';
  IF n <> 3 THEN
    RAISE EXCEPTION 'Expected 3 COMPLETED target shifts, found %. Aborting.', n;
  END IF;

  UPDATE public.shifts
     SET status = 'SCHEDULED',
         checked_in_at = NULL,
         checked_out_at = NULL,
         check_in_lat = NULL,
         check_in_lng = NULL
   WHERE id IN ('9b98f7d6-b30d-4e8c-a7dd-75c1503b8a7c','e4899cca-adc1-4a0d-bfab-901a668853b8','ffc11ff7-72e2-443d-91dc-1bb79785b50d')
     AND status = 'COMPLETED';
END $$;
