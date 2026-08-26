grant update (
  facility_name,
  default_price,
  cancellation_hours,
  timezone,
  updated_at
) on table public.facility_settings to authenticated;
