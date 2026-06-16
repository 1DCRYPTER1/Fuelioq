-- 1. Add RLS policy for public read access (This allows the map to actually see the data)
DROP POLICY IF EXISTS "Allow public read access" ON public.fuel_stations;
CREATE POLICY "Allow public read access"
  ON public.fuel_stations
  FOR SELECT
  TO public
  USING (true);

-- 2. Create the RPC function for the Map Bounding Box feature
CREATE OR REPLACE FUNCTION get_stations_in_bounds(min_lat float, min_lng float, max_lat float, max_lng float)
RETURNS SETOF public.fuel_stations AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.fuel_stations
  WHERE location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
END;
$$ LANGUAGE plpgsql;

-- 3. Ensure public access to the RPC function
GRANT EXECUTE ON FUNCTION get_stations_in_bounds TO public;
GRANT EXECUTE ON FUNCTION get_stations_in_bounds TO anon;
