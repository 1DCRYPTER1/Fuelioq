-- Create an RPC function to efficiently query fuel stations within a map's bounding box
CREATE OR REPLACE FUNCTION get_stations_in_bounds(min_lat float, min_lng float, max_lat float, max_lng float)
RETURNS SETOF public.fuel_stations AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.fuel_stations
  WHERE location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
END;
$$ LANGUAGE plpgsql;

-- Ensure public access to the RPC function (since RLS is enabled on the table, it still respects read-only policies)
GRANT EXECUTE ON FUNCTION get_stations_in_bounds TO public;
GRANT EXECUTE ON FUNCTION get_stations_in_bounds TO anon;
