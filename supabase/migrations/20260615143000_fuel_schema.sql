-- Enable PostGIS extension for geospatial queries
create extension if not exists postgis schema extensions;

-- Create the fuel_stations table
create table public.fuel_stations (
  id text primary key,
  brand text,
  name text,
  address text,
  phone text,
  location geography(point, 4326), -- Geospatial point (longitude, latitude)
  state text,
  status text,
  prices jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create a spatial index for blazing fast map bounding box queries
create index fuel_stations_geo_index
  on public.fuel_stations
  using gist (location);

-- Enable Row Level Security (RLS)
alter table public.fuel_stations enable row level security;

-- Allow public read access to everyone
create policy "Allow public read access"
  on public.fuel_stations
  for select
  to public
  using (true);

-- Note: The Edge Function uses the SUPABASE_SERVICE_ROLE_KEY, which natively bypasses RLS.
-- No policies are needed for inserts/updates. The table is now 100% secure!
