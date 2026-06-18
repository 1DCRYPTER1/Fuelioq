// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SA_BASE_URL = "https://fppdirectapi-prod.safuelpricinginformation.com.au";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = Deno.env.get("SA_API_TOKEN");
    if (!token) {
      throw new Error("Missing SA_API_TOKEN. Please add it via Supabase Secrets.");
    }

    const headers = {
      "Authorization": `FPDAPI SubscriberToken=${token}`,
      "Content-Type": "application/json"
    };

    console.log("Fetching SA Fuel Types...");
    const fuelsRes = await fetch(`${SA_BASE_URL}/Subscriber/GetCountryFuelTypes?countryId=21`, { headers });
    if (!fuelsRes.ok) throw new Error("Failed to fetch SA Fuel Types");
    const fuelsData = await fuelsRes.json();
    const fuelMap = new Map();
    fuelsData.Fuels?.forEach((f: any) => fuelMap.set(f.FuelId, f.Name));

    console.log("Fetching SA Brands...");
    const brandsRes = await fetch(`${SA_BASE_URL}/Subscriber/GetCountryBrands?countryId=21`, { headers });
    if (!brandsRes.ok) throw new Error("Failed to fetch SA Brands");
    const brandsData = await brandsRes.json();
    const brandMap = new Map();
    brandsData.Brands?.forEach((b: any) => brandMap.set(b.BrandId, b.Name));

    console.log("Fetching SA Site Details...");
    const sitesRes = await fetch(`${SA_BASE_URL}/Subscriber/GetFullSiteDetails?countryId=21&geoRegionLevel=3&geoRegionId=4`, { headers });
    if (!sitesRes.ok) throw new Error("Failed to fetch SA Site Details");
    const sitesData = await sitesRes.json();

    console.log("Fetching SA Site Prices...");
    const pricesRes = await fetch(`${SA_BASE_URL}/Price/GetSitesPrices?countryId=21&geoRegionLevel=3&geoRegionId=4`, { headers });
    if (!pricesRes.ok) throw new Error("Failed to fetch SA Site Prices");
    const pricesData = await pricesRes.json();

    // Group prices by site
    const pricesBySite = new Map();
    pricesData.SitePrices?.forEach((p: any) => {
      if (!pricesBySite.has(p.SiteId)) {
        pricesBySite.set(p.SiteId, []);
      }
      pricesBySite.get(p.SiteId).push({
        type: fuelMap.get(p.FuelId) || `Unknown (${p.FuelId})`,
        value: p.Price / 10, // Convert e.g., 1579.0 to 157.9 cents
        active: true,
        updated_at: p.TransactionDateUtc
      });
    });

    console.log("Mapping Data...");
    const mappedStations = [];

    if (sitesData.S) {
      for (const st of sitesData.S) {
        const siteId = st.S;
        const brandName = brandMap.get(st.B) || "Independent";
        const prices = pricesBySite.get(siteId) || [];
        
        mappedStations.push({
          id: `SA_${siteId}`,
          name: st.N,
          brand: brandName,
          address: st.A + (st.P ? ` ${st.P}` : ""),
          state: "SA",
          status: "Open",
          location: `POINT(${st.Lng} ${st.Lat})`,
          prices: prices,
          updated_at: new Date().toISOString()
        });
      }
    }

    console.log(`Parsed ${mappedStations.length} unique stations from SA`);

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
