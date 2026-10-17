const ALLOWED_ORIGINS = [
  "https://handrewsama.github.io"
];

const DESTINATIONS = {
  zaragoza: { arrival_id: "ZAZ", label: "Saragossa" },
  torrijos: { arrival_id: "MAD", label: "Torrijos (via Madrid)" },
  ubago: { arrival_id: "AGP", label: "La Línea (via Màlaga)" }
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (corsOrigin) headers["Access-Control-Allow-Origin"] = corsOrigin;

    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET") {
      return respond({ error: "Mètode no permès" }, 405);
    }
    if (!corsOrigin) {
      return respond({ error: "Origen no autoritzat" }, 403);
    }
    if (!env.SERPAPI_KEY) {
      return respond({ error: "Falta configurar el secret SERPAPI_KEY" }, 500);
    }

    const url = new URL(request.url);
    const destination = url.searchParams.get("destination");
    const outbound = url.searchParams.get("outbound");
    const returning = url.searchParams.get("return");

    if (!DESTINATIONS[destination]) {
      return respond({ error: "Destinació no vàlida" }, 400);
    }

    const validDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
    };

    if (!validDate(outbound) || !validDate(returning) || returning < outbound) {
      return respond({ error: "Dates no vàlides" }, 400);
    }

    const params = new URLSearchParams({
      engine: "google_flights",
      departure_id: "BCN",
      arrival_id: DESTINATIONS[destination].arrival_id,
      outbound_date: outbound,
      return_date: returning,
      type: "1",
      travel_class: "1",
      adults: "1",
      currency: "EUR",
      hl: "es",
      gl: "es",
      api_key: env.SERPAPI_KEY
    });

    try {
      const response = await fetch("https://serpapi.com/search.json?" + params.toString());
      const data = await response.json();

      if (!response.ok || data.error) {
        return respond({
          error: data.error || "Error consultant Google Flights",
          destination: DESTINATIONS[destination].label
        }, response.status === 429 ? 429 : 502);
      }

      return respond({
        destination: DESTINATIONS[destination].label,
        origin: "Barcelona",
        outbound,
        return: returning,
        currency: "EUR",
        best_flights: data.best_flights || [],
        other_flights: data.other_flights || [],
        price_insights: data.price_insights || null,
        search_metadata: {
          status: data.search_metadata?.status || null,
          google_flights_url: data.search_metadata?.google_flights_url || null
        }
      });
    } catch {
      return respond({ error: "No s'ha pogut connectar amb SerpApi" }, 502);
    }
  }
};
