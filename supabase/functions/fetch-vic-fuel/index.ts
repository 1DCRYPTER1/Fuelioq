// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VIC_BASE_URL = "https://api.fuel.service.vic.gov.au/open-data/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const consumerId = Deno.env.get("VIC_CONSUMER_ID");
    if (!consumerId) {
      throw new Error("Missing VIC_CONSUMER_ID. Please add it via Supabase Secrets.");
    }

    const headers = {
      "User-Agent": "Fuelioq/1.0",
      "x-consumer-id": consumerId,
      "x-transactionid": crypto.randomUUID(),
      "Content-Type": "application/json"
    };

    console.log("Fetching VIC Brands reference data...");
    let brandMap = new Map();
    try {
      const brandsRes = await fetch(`${VIC_BASE_URL}/fuel/reference-data/brands`, { headers });
      if (brandsRes.ok) {
        const brandsData = await brandsRes.json();
        brandsData.brands?.forEach((b: any) => {
          brandMap.set(b.id, b.name);
        });
      } else {
        console.warn(`Failed to fetch brands (status ${brandsRes.status}), proceeding with default IDs.`);
      }
    } catch (brandErr) {
      console.warn("Error fetching brands reference data:", brandErr);
    }

    console.log("Fetching VIC Fuel Prices...");
    const pricesRes = await fetch(`${VIC_BASE_URL}/fuel/prices`, { headers });
    if (!pricesRes.ok) {
      throw new Error(`Failed to fetch VIC prices: ${pricesRes.statusText}`);
    }
    const pricesData = await pricesRes.json();

    console.log("Mapping Data...");
    const mappedStations = [];

    if (pricesData.fuelPriceDetails) {
      for (const item of pricesData.fuelPriceDetails) {
        const st = item.fuelStation;
        if (!st) continue;

        const prices = (item.fuelPrices || []).map((p: any) => ({
          type: p.fuelType,
          value: parseFloat(p.price),
          active: !!p.isAvailable,
          updated_at: p.updatedAt
        }));

        const brandName = brandMap.get(st.brandId) || "Independent";

        mappedStations.push({
          id: `VIC_${st.id}`,
          name: st.name,
          brand: brandName,
          address: st.address,
          state: "VIC",
          status: "Open",
          location: `POINT(${st.location?.longitude} ${st.location?.latitude})`,
          prices: prices,
          updated_at: item.updatedAt || new Date().toISOString()
        });
      }
    }

    console.log(`Parsed ${mappedStations.length} unique stations from Victoria`);

    // Bulk Upsert to Database
    if (mappedStations.length > 0) {
      const { error } = await supabaseClient
        .from("fuel_stations")
        .upsert(mappedStations, { onConflict: "id" });
      
      if (error) {
        console.error("Database upsert failed:", error);
        throw error;
      }
    }

    return new Response(JSON.stringify({ success: true, count: mappedStations.length }), {
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
