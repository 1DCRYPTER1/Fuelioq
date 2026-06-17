// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase Client with Service Role Key (Has admin bypass for backend tasks)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Fetch WA FuelWatch RSS feeds in parallel for different fuel types
    console.log("Fetching FuelWatch RSS feeds in parallel...");
    const products = [
      { code: 1, type: "U91" },
      { code: 2, type: "U95" },
      { code: 6, type: "U98" },
      { code: 4, type: "Diesel" },
      { code: 11, type: "Premium Diesel" },
      { code: 5, type: "LPG" }
    ];

    const stationsMap = new Map();

    await Promise.all(products.map(async (prod) => {
      try {
        const response = await fetch(`https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS?Product=${prod.code}`);
        const xml = await response.text();

        // 2. Parse XML (Using Regex to avoid heavy XML parser dependencies in the edge function)
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
          const itemXml = match[1];
          
          const getVal = (tag: string) => {
            const m = itemXml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
            return m ? m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : ""; // Clean CDATA tags
          };

          const title = getVal("title");
          const brand = getVal("brand");
          const address = getVal("address");
          const latitude = parseFloat(getVal("latitude"));
          const longitude = parseFloat(getVal("longitude"));
          const priceStr = getVal("price");

          if (!isNaN(latitude) && !isNaN(longitude)) {
            // Construct standard station object
            const uniqueId = `WA_${brand}_${address}`.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
            const priceVal = parseFloat(priceStr);

            if (!stationsMap.has(uniqueId)) {
              stationsMap.set(uniqueId, {
                id: uniqueId,
                name: title,
                brand: brand,
                address: address,
                state: "WA",
                status: "Open",
                prices: [],
                location: `POINT(${longitude} ${latitude})`, // PostGIS format
                updated_at: new Date().toISOString(),
              });
            }

            const station = stationsMap.get(uniqueId);
            const existingPrice = station.prices.find((p: any) => p.type === prod.type);
            if (!existingPrice) {
              station.prices.push({ type: prod.type, value: priceVal, active: true });
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching/parsing product ${prod.type}:`, err);
      }
    }));

    const uniqueStations = Array.from(stationsMap.values());
    console.log(`Merged and parsed ${uniqueStations.length} unique stations from WA FuelWatch`);

    // 3. Upsert into Database
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

