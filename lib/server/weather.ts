// Optional: current weather for the stylist, from the free Open-Meteo API (no key needed).
export async function weatherFor(city: string): Promise<string> {
  if (!city) return '';
  try {
    const geo = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`, { signal: AbortSignal.timeout(5000) })).json();
    const place = geo.results?.[0];
    if (!place) return '';
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto`, { signal: AbortSignal.timeout(5000) })).json();
    const c = w.current, d = w.daily;
    if (!c) return '';
    return `${place.name}: ${Math.round(c.temperature_2m)}°C now (today ${Math.round(d.temperature_2m_min[0])} to ${Math.round(d.temperature_2m_max[0])}°C), ${d.precipitation_probability_max[0]}% chance of rain, wind ${Math.round(c.wind_speed_10m)} km/h.`;
  } catch {
    return '';
  }
}
