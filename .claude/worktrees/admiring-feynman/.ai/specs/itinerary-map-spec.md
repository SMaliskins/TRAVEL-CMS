# Itinerary Map — Fixed Specification

**DO NOT MODIFY map logic without updating this spec.**

## Terminology

- **Origin** = where they fly FROM (first departure point). NOT a destination.
- **Destination** = where they go (arrival cities).
- **Transit** = intermediate stop (e.g. Frankfurt with short layover).
- **Route points** = all points for map path: origin + destinations + transits, in chronological order.

## Map Route Points (OrderServicesBlock)

### Source: `mapRoutePoints` and `buildTravellerDestinations`

**Rule:** Full flight path = origin (first departure) + each arrival, in chronological order.

Example: TLL→FRA→NCE→FRA→TLL → route points: [Tallinn, Frankfurt, Nice, Frankfurt, Tallinn]

- **Origin** = first segment's departure (e.g. TLL).
- **Each arrival** = all segment arrivals (FRA, NCE, FRA, TLL) — including transits like Frankfurt.

### When no flights

Use hotels with 1+ night stay (city from hotelName/name/supplier).

### Fallback

When no route points from services → use `itineraryDestinations` from order's `countries_cities`.

## TripMap Component

- Receives `destinations` prop = route points (origin + stops).
- Draws lines between consecutive points.
- Bypass logic: paths crossing Ukraine/Russia/Belarus curve westward (lng ~17).
- Paths not crossing avoid zone: default curved bezier.

## Avoid Zones (TripMap)

- Ukraine, Russia, Belarus — paths must not cross.
- Bypass control point: (midLat, 17) — direction-independent for Latvia↔Turkey symmetry.

## Files

- `app/orders/[orderCode]/_components/OrderServicesBlock.tsx` — mapRoutePoints, buildTravellerDestinations
- `components/TripMap.tsx` — path rendering, bypass logic
