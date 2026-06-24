-- Enable the required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Schedule NSW (Runs at minute 0 past every hour)
SELECT cron.schedule(
  'fetch-nsw-fuel-cron',
  '0 * * * *',
  $$
    SELECT net.http_post(
        url:='https://ywemmerqendhkujkoigk.supabase.co/functions/v1/fetch-nsw-fuel',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_w_VnjvXPXUy49W50wFBO3Q_vmPx3fWl"}'::jsonb
    );
  $$
);

-- 2. Schedule QLD (Runs at minute 15 past every hour)
SELECT cron.schedule(
  'fetch-qld-fuel-cron',
  '15 * * * *',
  $$
    SELECT net.http_post(
        url:='https://ywemmerqendhkujkoigk.supabase.co/functions/v1/fetch-qld-fuel',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_w_VnjvXPXUy49W50wFBO3Q_vmPx3fWl"}'::jsonb
    );
  $$
);

-- 3. Schedule SA (Runs at minute 30 past every hour)
SELECT cron.schedule(
  'fetch-sa-fuel-cron',
  '30 * * * *',
  $$
    SELECT net.http_post(
        url:='https://ywemmerqendhkujkoigk.supabase.co/functions/v1/fetch-sa-fuel',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_w_VnjvXPXUy49W50wFBO3Q_vmPx3fWl"}'::jsonb
    );
  $$
);

-- 4. Schedule WA Fuelwatch (Runs at minute 45 past every hour)
SELECT cron.schedule(
  'fetch-fuelwatch-cron',
  '45 * * * *',
  $$
    SELECT net.http_post(
        url:='https://ywemmerqendhkujkoigk.supabase.co/functions/v1/fetch-fuelwatch',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_w_VnjvXPXUy49W50wFBO3Q_vmPx3fWl"}'::jsonb
    );
  $$
);

