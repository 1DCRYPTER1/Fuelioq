-- Drop if exists
DROP FUNCTION IF EXISTS get_stations_by_state(text);

CREATE OR REPLACE FUNCTION get_stations_by_state(state_name text)
RETURNS TABLE (
  id text, brand text, name text, address text, phone text, state text, status text, prices jsonb, updated_at timestamp with time zone, latitude float, longitude float
) AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.brand, f.name, f.address, f.phone, f.state, f.status, f.prices, f.updated_at,
         ST_Y(f.location::geometry) as latitude, ST_X(f.location::geometry) as longitude
  FROM public.fuel_stations f
  WHERE f.state = state_name;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_stations_by_state TO public;
GRANT EXECUTE ON FUNCTION get_stations_by_state TO anon;
