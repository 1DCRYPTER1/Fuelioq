-- 1. Create the history table
CREATE TABLE IF NOT EXISTS fuel_price_history (
    id BIGSERIAL PRIMARY KEY,
    station_id TEXT NOT NULL REFERENCES fuel_stations(id) ON DELETE CASCADE,
    fuel_type TEXT NOT NULL,
    price NUMERIC(5, 2) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_fuel_price_history_query 
ON fuel_price_history(station_id, fuel_type, recorded_at DESC);

-- 3. Enable RLS on the history table so public users can select it
ALTER TABLE fuel_price_history ENABLE ROW LEVEL SECURITY;

-- Check and drop policy if it exists to make script re-runnable safely
DROP POLICY IF EXISTS "Allow public read access to fuel_price_history" ON fuel_price_history;

CREATE POLICY "Allow public read access to fuel_price_history" 
ON fuel_price_history FOR SELECT 
TO public 
USING (true);

-- 4. Create trigger function to automatically track history
CREATE OR REPLACE FUNCTION log_fuel_price_changes()
RETURNS TRIGGER AS $$
DECLARE
    old_prices JSONB;
    new_prices JSONB;
    p_item JSONB;
    old_p_item JSONB;
    p_type TEXT;
    p_val NUMERIC;
    old_p_val NUMERIC;
    should_log BOOLEAN;
BEGIN
    old_prices := COALESCE(OLD.prices::jsonb, '[]'::jsonb);
    new_prices := COALESCE(NEW.prices::jsonb, '[]'::jsonb);

    -- Loop through new prices and check if they are different from old prices or if old prices didn't exist
    FOR p_item IN SELECT * FROM jsonb_array_elements(new_prices) LOOP
        p_type := p_item->>'type';
        p_val := (p_item->>'value')::numeric;

        -- Skip invalid or empty prices
        IF p_type IS NULL OR p_val IS NULL OR p_val <= 0 THEN
            CONTINUE;
        END IF;

        -- Find if this fuel type existed in old prices and what its value was
        should_log := TRUE;
        FOR old_p_item IN SELECT * FROM jsonb_array_elements(old_prices) LOOP
            IF old_p_item->>'type' = p_type THEN
                old_p_val := (old_p_item->>'value')::numeric;
                -- If the price has not changed, don't insert a redundant history point
                IF old_p_val = p_val THEN
                    should_log := FALSE;
                END IF;
                EXIT;
            END IF;
        END LOOP;

        -- If it's a new price or changed price, log it
        IF should_log THEN
            INSERT INTO fuel_price_history (station_id, fuel_type, price, recorded_at)
            VALUES (NEW.id, p_type, p_val, COALESCE(NEW.updated_at, NOW()));
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach the trigger to the fuel_stations table
DROP TRIGGER IF EXISTS trg_log_fuel_price_changes ON fuel_stations;
CREATE TRIGGER trg_log_fuel_price_changes
AFTER INSERT OR UPDATE ON fuel_stations
FOR EACH ROW
EXECUTE FUNCTION log_fuel_price_changes();

-- 6. RPC function to get daily state averages for analysis
CREATE OR REPLACE FUNCTION get_state_history_averages(state_code text, fuel_type_code text)
RETURNS TABLE (
    day DATE,
    average_price NUMERIC(5, 1)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.recorded_at::date AS day,
        ROUND(AVG(h.price), 1) AS average_price
    FROM fuel_price_history h
    JOIN fuel_stations s ON h.station_id = s.id
    WHERE s.state = state_code AND h.fuel_type = fuel_type_code
    GROUP BY day
    ORDER BY day ASC
    LIMIT 30;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

