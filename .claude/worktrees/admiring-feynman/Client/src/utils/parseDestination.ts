/**
 * Parse the countries_cities field from orders table.
 *
 * Input format: "origin:Riga, Latvia|Antalya, Turkey|return:Riga, Latvia"
 * Also handles simple formats like "Turkey, Antalya" or "Latvia - Turkey"
 */

export interface ParsedDestination {
  country: string | null
  city: string | null
  route: string | null
  label: string
}

export function parseDestination(countriesCities: string | null | undefined): ParsedDestination {
  const fallback: ParsedDestination = { country: null, city: null, route: null, label: '—' }
  if (!countriesCities) return fallback

  const raw = countriesCities.trim()

  if (raw.includes('origin:') || raw.includes('|')) {
    return parseStructuredFormat(raw)
  }

  return { country: null, city: null, route: null, label: raw }
}

function parseStructuredFormat(raw: string): ParsedDestination {
  const parts = raw.split('|').map((p) => p.trim()).filter(Boolean)

  let originCity: string | null = null
  let returnCity: string | null = null
  const destinations: { city: string; country: string }[] = []

  for (const part of parts) {
    if (part.startsWith('origin:')) {
      const val = part.replace('origin:', '').trim()
      originCity = extractCity(val)
    } else if (part.startsWith('return:')) {
      const val = part.replace('return:', '').trim()
      returnCity = extractCity(val)
    } else {
      const { city, country } = extractCityCountry(part)
      if (city || country) {
        destinations.push({ city: city || '', country: country || '' })
      }
    }
  }

  const mainDest = destinations[0]
  const country = mainDest?.country || null
  const city = mainDest?.city || null

  const routeParts: string[] = []
  if (originCity) routeParts.push(originCity)
  for (const d of destinations) {
    if (d.city && d.city !== originCity) routeParts.push(d.city)
  }
  if (returnCity && returnCity !== routeParts[routeParts.length - 1]) {
    routeParts.push(returnCity)
  }

  const route = routeParts.length > 1 ? routeParts.join(' — ') : null

  let label = '—'
  if (country && city) {
    label = `${country} (${city})`
  } else if (country) {
    label = country
  } else if (city) {
    label = city
  }

  return { country, city, route, label }
}

function extractCity(val: string): string {
  const comma = val.indexOf(',')
  return comma > 0 ? val.substring(0, comma).trim() : val.trim()
}

function extractCityCountry(val: string): { city: string; country: string } {
  const comma = val.indexOf(',')
  if (comma > 0) {
    return {
      city: val.substring(0, comma).trim(),
      country: val.substring(comma + 1).trim(),
    }
  }
  return { city: val.trim(), country: '' }
}
