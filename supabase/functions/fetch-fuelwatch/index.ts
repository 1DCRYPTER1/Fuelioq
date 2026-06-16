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

    // 1. Fetch WA FuelWatch RSS
    console.log("Fetching FuelWatch RSS...");
    const response = await fetch("https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS");
    const xml = await response.text();

    // 2. Parse XML (Using Regex to avoid heavy XML parser dependencies in the edge function)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    const stations = [];

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
        // Use both brand and address to ensure the ID is completely unique, as some addresses have multiple entries in the XML
        const uniqueId = `WA_${brand}_${address}`.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

        stations.push({
          id: uniqueId,
          name: title,
          brand: brand,
          address: address,
          state: "WA",
          status: "Open",
          prices: [{ type: "U91", value: parseFloat(priceStr), active: true }], // FuelWatch RSS defaults to ULP
          location: `POINT(${longitude} ${latitude})`, // PostGIS format
          updated_at: new Date().toISOString(),
        });
      }
    }

    console.log(`Parsed ${stations.length} stations from WA FuelWatch`);

    // Deduplicate the array by ID to prevent PostgreSQL "cannot affect row a second time" errors
    const uniqueStationsMap = new Map();
    for (const station of stations) {
      if (!uniqueStationsMap.has(station.id)) {
        uniqueStationsMap.set(station.id, station);
      }
    }
    const uniqueStations = Array.from(uniqueStationsMap.values());
    console.log(`Deduplicated to ${uniqueStations.length} unique stations`);

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
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
