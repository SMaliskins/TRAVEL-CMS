# Изменения для Edit Service Hotel

## 1. Миграция создана: migrations/add_hotel_fields.sql

## 2. Изменения в EditServiceModalNew.tsx

### 2.1. Обновить интерфейс Service (строки 35-39)
Добавить после hotelEmail:
```typescript
hotelRoom?: string;
hotelBoard?: "room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive";
hotelBedType?: "king_queen" | "twin" | "not_guaranteed";
hotelEarlyCheckIn?: boolean;
hotelLateCheckIn?: boolean;
hotelHigherFloor?: boolean;
hotelKingSizeBed?: boolean;
hotelHoneymooners?: boolean;
hotelSilentRoom?: boolean;
hotelRoomsNextTo?: string;
hotelParking?: boolean;
hotelPreferencesFreeText?: string;
supplierBookingType?: "gds" | "direct";
```

### 2.2. Добавить новые состояния (после строки 182)
```typescript
const [hotelRoom, setHotelRoom] = useState(service.hotelRoom || "");
const [hotelBoard, setHotelBoard] = useState<"room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive">(
  (service.hotelBoard as any) || "room_only"
);
const [hotelBedType, setHotelBedType] = useState<"king_queen" | "twin" | "not_guaranteed">(
  (service.hotelBedType as any) || "not_guaranteed"
);
const [hotelPreferences, setHotelPreferences] = useState({
  earlyCheckIn: service.hotelEarlyCheckIn || false,
  lateCheckIn: service.hotelLateCheckIn || false,
  higherFloor: service.hotelHigherFloor || false,
  kingSizeBed: service.hotelKingSizeBed || false,
  honeymooners: service.hotelHoneymooners || false,
  silentRoom: service.hotelSilentRoom || false,
  roomsNextTo: service.hotelRoomsNextTo || "",
  parking: service.hotelParking || false,
  freeText: service.hotelPreferencesFreeText || "",
});
const [supplierBookingType, setSupplierBookingType] = useState<"gds" | "direct">(
  (service.supplierBookingType as any) || "gds"
);
```

### 2.3. Добавить useEffect для копирования Name в Hotel Name (после строки 347)
```typescript
// Copy service name to hotel name when category is Hotel
useEffect(() => {
  if (category === "Hotel" && serviceName.trim() && !hotelName.trim()) {
    setHotelName(serviceName.trim());
  }
}, [category, serviceName, hotelName]);

// For Hotel: when refundPolicy is non_ref, set payment deadline to today
useEffect(() => {
  if (category === "Hotel" && refundPolicy === "non_ref") {
    const today = new Date().toISOString().split('T')[0];
    setPaymentDeadlineFinal(today);
  }
}, [category, refundPolicy]);

// For Hotel: when refundPolicy is refundable, set payment deadline to free cancellation until
useEffect(() => {
  if (category === "Hotel" && refundPolicy === "refundable" && freeCancellationUntil) {
    setPaymentDeadlineFinal(freeCancellationUntil);
  }
}, [category, refundPolicy, freeCancellationUntil]);
```

### 2.4. Обновить секцию Supplier (строки 936-944)
Заменить на:
```typescript
<div>
  <label className="block text-xs font-medium text-gray-600 mb-0.5">Supplier</label>
  {category === "Hotel" ? (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-0.5">Booking Type</label>
        <select
          value={supplierBookingType}
          onChange={(e) => {
            const newType = e.target.value as "gds" | "direct";
            setSupplierBookingType(newType);
            if (newType === "direct" && hotelName.trim()) {
              setSupplierName(hotelName.trim());
            }
          }}
          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
        >
          <option value="gds">GDS</option>
          <option value="direct">Direct booking</option>
        </select>
      </div>
      {supplierBookingType === "direct" ? (
        <div className="flex gap-1">
          <div className="flex-1">
            <PartySelect
              value={supplierPartyId}
              onChange={(id, name) => { 
                setSupplierPartyId(id); 
                setSupplierName(name); 
              }}
              roleFilter="supplier"
              initialDisplayName={supplierName || hotelName}
            />
          </div>
          {!supplierPartyId && hotelName.trim() && (
            <button
              type="button"
              onClick={() => {
                // TODO: Open add supplier modal or navigate to directory
                alert(`Add "${hotelName}" to directory as supplier?`);
              }}
              className="px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              title="Add supplier to directory"
            >
              +
            </button>
          )}
        </div>
      ) : (
        <PartySelect
          value={supplierPartyId}
          onChange={(id, name) => { setSupplierPartyId(id); setSupplierName(name); }}
          roleFilter="supplier"
          initialDisplayName={supplierName}
        />
      )}
    </div>
  ) : (
    <PartySelect
      value={supplierPartyId}
      onChange={(id, name) => { setSupplierPartyId(id); setSupplierName(name); }}
      roleFilter="supplier"
      initialDisplayName={supplierName}
    />
  )}
</div>
```

### 2.5. Обновить Booking Terms для Hotel (строки 1223-1292)
Заменить Refund Policy на:
```typescript
{/* Refund Policy - for Hotel: only non_ref and refundable */}
<div className={category === "Tour" ? "" : category === "Flight" ? "" : "col-span-2"}>
  <label className="block text-xs font-medium text-gray-600 mb-0.5">Refund Policy</label>
  <select
    value={refundPolicy}
    onChange={(e) => setRefundPolicy(e.target.value as "non_ref" | "refundable" | "fully_ref")}
    className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
  >
    {category === "Hotel" ? (
      <>
        <option value="non_ref">Non-refundable</option>
        <option value="refundable">Refundable (with conditions)</option>
      </>
    ) : (
      <>
        <option value="non_ref">Non-refundable</option>
        <option value="refundable">Refundable (with conditions)</option>
        <option value="fully_ref">Fully Refundable</option>
      </>
    )}
  </select>
</div>
```

Заменить Cancellation/Refund details на:
```typescript
{/* Cancellation/Refund details - only if refundable */}
{refundPolicy !== "non_ref" && (
  <div className={category === "Hotel" ? "grid grid-cols-1 gap-2" : "grid grid-cols-3 gap-2"}>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-0.5">Free cancel until</label>
      <input
        type="date"
        value={freeCancellationUntil}
        onChange={(e) => setFreeCancellationUntil(e.target.value)}
        className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
      />
    </div>
    {/* Penalty fields - hidden for Hotel */}
    {category !== "Hotel" && (
      <>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Penalty EUR</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={cancellationPenaltyAmount}
            onChange={(e) => setCancellationPenaltyAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Penalty %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={cancellationPenaltyPercent}
            onChange={(e) => setCancellationPenaltyPercent(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
          />
        </div>
      </>
    )}
  </div>
)}
```

Обновить Payment Deadlines для Hotel (после строки 1346):
```typescript
) : category === "Hotel" ? (
  // Hotel: single Payment Deadline (auto-set based on refund policy)
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Deadline</label>
    <input
      type="date"
      value={paymentDeadlineFinal}
      onChange={(e) => setPaymentDeadlineFinal(e.target.value)}
      className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
    />
    {refundPolicy === "non_ref" && (
      <span className="text-xs text-gray-500 mt-1 block">Auto-set to today for non-refundable</span>
    )}
    {refundPolicy === "refundable" && (
      <span className="text-xs text-gray-500 mt-1 block">Auto-set to Free cancel until date</span>
    )}
  </div>
) : (
```

### 2.6. Обновить Hotel Details секцию (строки 1365-1383)
Заменить полностью на расширенную версию с Room, Board, Bed Type, Preferences и кнопкой Send to Hotel.

### 2.7. Обновить payload при сохранении (строки 641-647)
Добавить все новые hotel поля в payload.

## 3. Settings - Financial и Travel Services

### 3.1. Обновить app/settings/company/page.tsx
- Переименовать "Banking Details" в "Financial"
- Добавить настройки VAT (основной VAT страны)

### 3.2. Создать app/settings/travel-services/page.tsx
- Раздел для управления категориями travel services
- Для каждой категории указать VAT

