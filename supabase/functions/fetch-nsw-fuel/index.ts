// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NSW API specifically requires timestamps in 'dd/MM/yyyy hh:mm:ss AM/PM' format
function getNSWTimestamp() {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  // Strip commas and replace Narrow No-Break Spaces (U+202F) or other non-ASCII chars with standard spaces
  return formatter.format(d).replace(',', '').replace(/[\u202F\u00A0]/g, ' ').replace(/[^ -~]/g, '');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // We pull the API credentials from the secure Supabase Edge Function Secrets
    const apiKey = Deno.env.get("NSW_API_KEY");
    const apiSecret = Deno.env.get("NSW_API_SECRET");

    if (!apiKey || !apiSecret) {
      throw new Error("Missing NSW_API_KEY or NSW_API_SECRET. Please add them via Supabase Secrets.");
    }

    // 1. Authenticate with OAuth to get the Bearer Token
    console.log("Authenticating with NSW FuelCheck API...");
    const authString = btoa(`${apiKey}:${apiSecret}`);
    const tokenRes = await fetch("https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken?grant_type=client_credentials", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authString}`
      }
    });
    
    if (!tokenRes.ok) throw new Error("Failed to authenticate with NSW API");
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch the Live Prices & Stations
    console.log("Fetching latest NSW prices...");
    const txId = crypto.randomUUID();
    const ts = getNSWTimestamp();
    
    const priceRes = await fetch("https://api.onegov.nsw.gov.au/FuelPriceCheck/v1/fuel/prices", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "apikey": apiKey,
        "transactionid": txId,
        "requesttimestamp": ts,
        "Content-Type": "application/json; charset=utf-8"
      }
    });

    if (!priceRes.ok) throw new Error(`Failed to fetch NSW Fuel data: ${priceRes.statusText}`);
    const data = await priceRes.json();

    // 3. Map Data to the standardized Supabase PostGIS Schema
    const mappedStations = new Map();

    if (data.stations) {
      for (const st of data.stations) {
        // Determine if it's an ACT station based on the address
        let stationState = "NSW";
        if (st.address && st.address.match(/\bACT\b/i)) {
          stationState = "ACT";
        }

        mappedStations.set(st.code, {
          id: `${stationState}_${st.code}`,
          name: st.name,
          brand: st.brand,
          address: st.address,
          state: stationState,
          status: "Open",
          location: `POINT(${st.location.longitude} ${st.location.latitude})`,
          prices: [],
          updated_at: new Date().toISOString()
        });
      }
    }

    if (data.prices) {
      for (const p of data.prices) {
        if (mappedStations.has(p.stationcode)) {
          const station = mappedStations.get(p.stationcode);
          station.prices.push({
            type: p.fueltype,
            value: parseFloat(p.price),
            active: true
          });
        }
      }
    }

    const uniqueStations = Array.from(mappedStations.values());
    console.log(`Parsed ${uniqueStations.length} unique stations from NSW FuelCheck`);

    // 4. Bulk Upsert to Database
    if (uniqueStations.length > 0) {
      const { error } = await supabaseClient
        .from("fuel_stations")
        .upsert(uniqueStations, { onConflict: "id" });
      
      if (error) {
        console.error("Database upsert failed:", error);
        throw error;
      }
    }

    return new Response(JSON.stringify({ success: true, count: uniqueStations.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

