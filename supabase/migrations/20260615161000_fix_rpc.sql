DROP FUNCTION IF EXISTS get_stations_in_bounds(float, float, float, float);

CREATE OR REPLACE FUNCTION get_stations_in_bounds(min_lat float, min_lng float, max_lat float, max_lng float)
RETURNS TABLE (
  id text,
  brand text,
  name text,
  address text,
  phone text,
  state text,
  status text,
  prices jsonb,
  updated_at timestamp with time zone,
  latitude float,
  longitude float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id, f.brand, f.name, f.address, f.phone, f.state, f.status, f.prices, f.updated_at,
    ST_Y(f.location::geometry) as latitude,
    ST_X(f.location::geometry) as longitude
  FROM public.fuel_stations f
  WHERE f.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_stations_in_bounds TO public;
GRANT EXECUTE ON FUNCTION get_stations_in_bounds TO anon;
