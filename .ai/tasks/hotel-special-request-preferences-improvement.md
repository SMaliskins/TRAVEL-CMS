# Hotel Special Request / Preferences — Improvement Task

**Created:** 2026-03-20  
**Status:** TODO  
**Area:** Orders — Hotel & Tour Package Services  
**Pipeline:** DB (schema if new columns) → Code Writer → QA

---

## Reference (from external modal)

Special Request modal with 4 categories:

| Category | Options |
|----------|---------|
| **Room** | Low Floor, High Floor, Adjoining, Interconnecting, Smoking, Non-Smoking, VIP |
| **Bedding** | Double, Twin |
| **Check In/Out** | Early check-in (dropdown: Select, 06:00–14:00) |
| **Occasion** | Birthday, Anniversary, Honeymoon |

UI: 4-column layout, disclaimer text, Add button.

---

## Current State (Travel CMS)

### Hotel preferences (category Hotel only)

**Location:** `AddServiceModal.tsx`, `EditServiceModalNew.tsx`

**Flat list of checkboxes:**
- Early check-in + `<input type="time">`
- Late check-in + time
- Late check-out + time
- Room upgrade
- Higher floor
- King size bed
- Honeymooners
- Silent room
- Repeat Guests
- Parking
- Rooms next to (text)
- Additional preferences (textarea)

**Bed Type** is separate: King/Queen, Twin, Not guaranteed.

### Tour Package with hotel

- `showHotelFields = categoryType === "hotel"` — preferences shown **only** for Hotel category.
- Tour Package has hotelName, hotelRoom, hotelBoard, hotelBedType, etc., but **no Special Request / preferences** — they are not rendered and not saved.

---

## Gaps

| Aspect | Reference | Travel CMS |
|--------|-----------|------------|
| **Structure** | 4 groups (Room, Bedding, Check In/Out, Occasion) | Flat list |
| **Room** | Low/High floor, Adjoining, Interconnecting, Smoking/Non-Smoking, VIP | Higher floor, Room upgrade, Silent room, Rooms next to |
| **Bedding** | Double, Twin (in Special Request) | King/Queen, Twin, Not guaranteed (Bed Type field) |
| **Check-in time** | Dropdown 06:00–14:00 | `<input type="time">` |
| **Occasion** | Birthday, Anniversary, Honeymoon | Only Honeymooners |
| **Tour Package** | — | No preferences section |

---

## Tasks

1. **Tour Package: show preferences**
   - For `categoryType === "tour"` and presence of hotel (e.g. hotelName), show hotel preferences block.
   - Save/load preferences for Tour Package with hotel.

2. **Optional: expand options**
   - Add: Low Floor, Adjoining, Interconnecting, Smoking, Non-Smoking, VIP, Birthday, Anniversary.
   - DB migration if new columns.

3. **Optional: UI restructure**
   - Group by Room / Bedding / Check In/Out / Occasion.
   - Early check-in: dropdown (Select, 06:00–14:00) instead of time input.

---

## Files

- `app/orders/[orderCode]/_components/AddServiceModal.tsx`
- `app/orders/[orderCode]/_components/EditServiceModalNew.tsx`
- `migrations/add_hotel_fields.sql` (existing)
- API: `app/api/orders/[orderCode]/services/route.ts`, `[serviceId]/route.ts`

---

## DB schema (current)

`order_services`:  
hotel_early_check_in, hotel_early_check_in_time, hotel_late_check_in, hotel_late_check_in_time,  
hotel_late_check_out, hotel_late_check_out_time, hotel_room_upgrade, hotel_higher_floor,  
hotel_king_size_bed, hotel_honeymooners, hotel_silent_room, hotel_repeat_guests,  
hotel_rooms_next_to, hotel_parking, hotel_preferences_free_text

New columns (if expanding): hotel_low_floor, hotel_adjoining, hotel_interconnecting,  
hotel_smoking, hotel_non_smoking, hotel_vip, hotel_birthday, hotel_anniversary, etc.
