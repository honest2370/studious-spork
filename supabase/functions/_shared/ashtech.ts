export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const ASHTECH_BASE = "https://ashtechpay.top";

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function getCurrencyForCountry(apiKey: string, countryCode: string): Promise<string | null> {
  try {
    const res = await fetch(`${ASHTECH_BASE}/v1/countries`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const countries = await res.json();
    if (!Array.isArray(countries)) return null;
    return countries.find((c: any) => c.code === countryCode)?.currency || null;
  } catch {
    return null;
  }
}
