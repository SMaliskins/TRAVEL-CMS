# 💻 CODE WRITER: OD2 — Services Table Redesign

**Date:** 2026-01-11  
**Agent:** UI System / Consistency  
**For:** Code Writer  
**Priority:** 🔴 HIGH  
**Complexity:** 🔴 Complex  
**Estimated Time:** 3-4 days  

---

## 📋 ЗАДАЧА

Редизайн Services Table на странице Order Detail:
- Улучшить UX (убрать Expanded Row, добавить double-click edit)
- Добавить Checklist Panel в Client Card
- Улучшить Split modal (Overview + Tabs)
- Изменить логику Cancel/Delete

**URL:** `/orders/[orderCode]/page.tsx` (Services tab)

---

## 1️⃣ SERVICES TABLE — Структура колонок

### **Оставляем все 12 колонок:**

```tsx
<thead>
  <tr>
    <th>☐</th>              {/* Checkbox для bulk select */}
    <th>Category</th>        {/* Icon + text */}
    <th>Name</th>            {/* Название услуги */}
    <th>Supplier</th>        {/* ✅ ОСТАВЛЯЕМ в main view */}
    <th>Client</th>          {/* Кто едет */}
    <th>Payer</th>           {/* Кто платит */}
    <th>Service Price</th>   {/* ✅ ОСТАВЛЯЕМ (агентский доступ) */}
    <th>Client Price</th>    {/* Цена клиента */}
    <th>Res Status</th>      {/* Статус бронирования */}
    <th>Ref Nr</th>          {/* ✅ ОСТАВЛЯЕМ (копирование, поиск) */}
    <th>Ticket Nr</th>       {/* ✅ ОСТАВЛЯЕМ */}
    <th></th>                {/* Actions (Cancel button) */}
  </tr>
</thead>
```

### **Ширины колонок (рекомендуемые):**

```css
.col-checkbox { width: 40px; }
.col-category { width: 60px; }
.col-name { width: 180px; }
.col-supplier { width: 120px; }
.col-client { width: 140px; }
.col-payer { width: 140px; }
.col-service-price { width: 80px; }
.col-client-price { width: 80px; }
.col-status { width: 100px; }
.col-ref { width: 100px; }
.col-ticket { width: 100px; }
.col-actions { width: 40px; }
```

---

## 2️⃣ CLIENT / PAYER — Логика отображения

### **Требование:**
> "Client = Payer: дублировать имя"

```tsx
// ✅ Дублируем имя в обеих колонках
<td className="px-3 py-2 text-sm">{service.client_name}</td>
<td className="px-3 py-2 text-sm">{service.payer_name}</td>

// Если одинаковые — показываем оба (дубликат)
// Если разные — тоже показываем оба
```

**Визуально:**

```
CLIENT        | PAYER
--------------|-------------
Sergejs M.    | Company Ltd   ← разные
Antons N.     | Antons N.     ← одинаковые (дублируем)
```

---

## 3️⃣ RES STATUS — По умолчанию пустое

### **Требование:**
> "RES STATUS - по умолчанию пустое поле должно быть, мы сами его должны менять"

```tsx
// При создании нового сервиса
const newService = {
  ...otherFields,
  res_status: null, // ❌ НЕ "Booked" по умолчанию
};

// В таблице
<td className="px-3 py-2">
  {service.res_status ? (
    <StatusBadge status={service.res_status} />
  ) : (
    <span className="text-xs text-gray-400">Not set</span>
  )}
</td>
```

**Возможные статусы:**
- `null` → "Not set" (серый)
- `"booked"` → "✅ Booked" (зеленый)
- `"confirmed"` → "✅ Confirmed" (синий)
- `"changed"` → "🟡 Changed" (желтый)
- `"rejected"` → "🔴 Rejected" (красный)
- `"cancelled"` → "🚫 Cancelled" (серый)

---

## 4️⃣ CANCEL BUTTON — Hover effect

### **Требование:**
> "Delete (🗑️) нельзя delete, можно только Cancel"
> "Cancel action: Строка становится серой и статус меняется на Cancelled"

```tsx
<tr 
  className={cn(
    "group hover:bg-gray-50 transition-colors",
    service.res_status === 'cancelled' && "bg-gray-100 opacity-60"
  )}
  onDoubleClick={() => openEditModal(service)}
>
  {/* ... columns ... */}
  
  <td className="px-2 py-2 text-right">
    {service.res_status !== 'cancelled' && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleCancelService(service.id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity
                   text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
        title="Cancel Service"
      >
        🚫
      </button>
    )}
  </td>
</tr>
```

### **handleCancelService — логика:**

```tsx
const handleCancelService = async (serviceId: string) => {
  // Confirm dialog
  const confirmed = await confirm({
    title: "Cancel Service?",
    message: "This will mark the service as cancelled. You can revert this later.",
    confirmText: "Yes, Cancel",
    cancelText: "No, Keep it"
  });
  
  if (!confirmed) return;
  
  // Update status
  await updateService(serviceId, {
    res_status: 'cancelled'
  });
  
  // Refresh table
  refreshServices();
};
```

**Визуальный эффект после Cancel:**
- Строка становится `bg-gray-100 opacity-60`
- Статус меняется на "🚫 Cancelled"
- Cancel button исчезает (уже cancelled)
- Можно добавить filter "Show/Hide cancelled services"

---

## 5️⃣ УБРАТЬ EXPANDED ROW

### **Требование:**
> "Expanded row убрать, он мешает"

```tsx
// ❌ УДАЛИТЬ:
// - Expanded row component
// - Кнопки Edit/Split/Delete под строкой
// - Toggle логику для expand/collapse

// ✅ ВМЕСТО ЭТОГО:
// - Double-click на row → Edit modal
// - Hover → Cancel button
```

---

## 6️⃣ DOUBLE-CLICK TO EDIT

### **Требование:**
> "Edit происходит когда дважды нажимаем на саму строку сервиса"

```tsx
<tr 
  onDoubleClick={() => openEditServiceModal(service)}
  className="cursor-pointer"
>
  {/* ... columns ... */}
</tr>
```

**Note:** Убедиться что double-click не конфликтует с:
- Single click на checkbox
- Click на Cancel button
- Click на Status dropdown (если inline edit)

---

## 7️⃣ CHECKLIST PANEL — Client Card

### **Требование:**
> "TICKET NR можно поступить иначе - добавить к client info справа check по заявке, и там писать все, на что нужно обратить внимание. И одно из вниманий будет - Не внесен номер билета."

### **Добавить в Client Card (справа):**

```tsx
<div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
  <h3 className="text-sm font-semibold text-amber-900 mb-2">
    ⚠️ Attention Required
  </h3>
  
  <div className="space-y-2">
    {/* Auto-generated checklist */}
    {checklist.map((item) => (
      <label key={item.id} className="flex items-start gap-2 text-xs">
        <input 
          type="checkbox" 
          checked={item.resolved}
          onChange={() => toggleChecklistItem(item.id)}
          className="mt-0.5"
        />
        <span className={cn(
          item.resolved && "line-through text-gray-500"
        )}>
          {item.message}
        </span>
      </label>
    ))}
  </div>
</div>
```

### **Логика генерации checklist:**

```tsx
const generateChecklist = (order: Order) => {
  const items = [];
  
  // Check for missing ticket numbers (только для Flights)
  const flightsWithoutTicket = order.services.filter(
    s => s.category === 'Flight' && !s.ticket_nr && s.res_status !== 'cancelled'
  );
  if (flightsWithoutTicket.length > 0) {
    items.push({
      id: 'missing-tickets',
      type: 'warning',
      message: `Ticket Nr not entered (${flightsWithoutTicket.length} flights)`,
      resolved: false
    });
  }
  
  // Check for missing ref numbers (для всех категорий)
  const servicesWithoutRef = order.services.filter(
    s => !s.ref_nr && s.res_status !== 'cancelled'
  );
  if (servicesWithoutRef.length > 0) {
    items.push({
      id: 'missing-refs',
      type: 'warning',
      message: `Ref Nr not entered (${servicesWithoutRef.length} services)`,
      resolved: false
    });
  }
  
  // Check payment status
  if (order.amount_paid < order.amount_total) {
    items.push({
      id: 'payment-pending',
      type: 'warning',
      message: `Payment pending: €${(order.amount_total - order.amount_paid).toFixed(2)}`,
      resolved: false
    });
  }
  
  // Check documents
  if (order.documents?.length === 0) {
    items.push({
      id: 'documents-missing',
      type: 'info',
      message: 'No documents uploaded',
      resolved: false
    });
  }
  
  // Check unconfirmed services
  const unconfirmedServices = order.services.filter(
    s => s.res_status === 'booked' && s.res_status !== 'cancelled'
  );
  if (unconfirmedServices.length > 0) {
    items.push({
      id: 'unconfirmed-services',
      type: 'info',
      message: `${unconfirmedServices.length} services not confirmed yet`,
      resolved: false
    });
  }
  
  return items;
};
```

**Визуально:**

```
┌─────────────────────────────────┐
│ 👤 Antons Nenaševs              │
│ 📧 antons@email.com             │
│ 📞 +371 12345678                │
│                                 │
│ 🗺️ Route:                       │
│ 🇪🇸 Palma → 🇨🇿 Prague          │
│                                 │
│ 📅 10.02 — 26.02.2026           │
│ ⏰ 30 days before               │
│                                 │
│ ⚠️ Attention Required           │
│ ┌─────────────────────────────┐ │
│ │☐ Ticket Nr not entered (2)  │ │
│ │☐ Payment pending: €434      │ │
│ │☑️ Ref Nr entered for all    │ │ ← resolved
│ └─────────────────────────────┘ │
│                                 │
│ 💰 Payment: €1,234              │
└─────────────────────────────────┘
```

---

## 8️⃣ SPLIT MODAL — Overview + Tabs

### **Требование:**
> "Вариант В: Табы, но сделать так, чтобы общее превью было в первом окне, а при клике на каждый отдельный сервис переходило в нужный таб"

### **Структура:**

```tsx
<Dialog open={splitModalOpen}>
  <DialogHeader>
    <DialogTitle>🔪 Split Selected Services ({selectedServices.length})</DialogTitle>
  </DialogHeader>
  
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList>
      <TabsTrigger value="overview">📋 Overview</TabsTrigger>
      {selectedServices.map((service, idx) => (
        <TabsTrigger key={service.id} value={`service-${idx}`}>
          {idx + 1}️⃣ {service.name}
        </TabsTrigger>
      ))}
    </TabsList>
    
    {/* Tab 0: Overview */}
    <TabsContent value="overview">
      <SplitOverview 
        services={selectedServices}
        onEditService={(serviceId) => setActiveTab(`service-${getServiceIndex(serviceId)}`)}
      />
    </TabsContent>
    
    {/* Tab 1-N: Individual services */}
    {selectedServices.map((service, idx) => (
      <TabsContent key={service.id} value={`service-${idx}`}>
        <SplitServiceForm 
          service={service}
          onApply={() => setActiveTab('overview')}
          onPrevious={() => setActiveTab(idx > 0 ? `service-${idx-1}` : 'overview')}
          onNext={() => setActiveTab(idx < selectedServices.length - 1 ? `service-${idx+1}` : 'overview')}
        />
      </TabsContent>
    ))}
  </Tabs>
  
  <DialogFooter>
    <Button variant="outline" onClick={closeSplitModal}>Cancel</Button>
    <Button onClick={applyAllSplits}>Apply Split ({splitCount})</Button>
  </DialogFooter>
</Dialog>
```

---

### **8.1 Overview Tab Component:**

```tsx
const SplitOverview = ({ services, onEditService }) => {
  return (
    <div className="space-y-3 max-h-[500px] overflow-y-auto">
      <p className="text-sm text-gray-600 mb-4">
        Click on a service to configure split:
      </p>
      
      {services.map((service, idx) => {
        const splitStatus = getSplitStatus(service.id);
        
        return (
          <div
            key={service.id}
            onClick={() => onEditService(service.id)}
            className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer
                       transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{getCategoryIcon(service.category)}</span>
                <div>
                  <div className="font-medium">
                    {idx + 1}. {service.name}
                  </div>
                  <div className="text-xs text-gray-600">
                    Client: {service.client_name} | Payer: {service.payer_name}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    Total: €{service.client_price}
                  </div>
                  {splitStatus.isSplit ? (
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      ✅ Split into {splitStatus.parts} parts
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 flex items-center gap-1">
                      ⚠️ Not split yet
                    </div>
                  )}
                </div>
                
                <button 
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium
                           opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Edit →
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

---

### **8.2 Split Service Form Component:**

```tsx
const SplitServiceForm = ({ service, onApply, onPrevious, onNext }) => {
  const [parts, setParts] = useState([
    { payer_id: service.payer_id, client_price: service.client_price, service_price: service.service_price }
  ]);
  
  const handleDivideEqually = () => {
    const clientPricePerPart = (service.client_price / parts.length).toFixed(2);
    const servicePricePerPart = (service.service_price / parts.length).toFixed(2);
    
    setParts(parts.map((part, idx) => ({
      ...part,
      client_price: parseFloat(clientPricePerPart),
      service_price: parseFloat(servicePricePerPart)
    })));
  };
  
  const handleAddPart = () => {
    setParts([...parts, { 
      payer_id: null, 
      client_price: 0, 
      service_price: 0 
    }]);
  };
  
  const totalClientPrice = parts.reduce((sum, p) => sum + p.client_price, 0);
  const totalServicePrice = parts.reduce((sum, p) => sum + p.service_price, 0);
  
  const isValid = 
    totalClientPrice === service.client_price &&
    totalServicePrice === service.service_price;
  
  return (
    <div className="space-y-4">
      {/* Service Info */}
      <div className="p-3 bg-gray-50 rounded-lg grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-600">Category:</span> {service.category}
        </div>
        <div>
          <span className="text-gray-600">Client Price:</span> €{service.client_price}
        </div>
        <div>
          <span className="text-gray-600">Supplier:</span> {service.supplier || '-'}
        </div>
        <div>
          <span className="text-gray-600">Service Price:</span> €{service.service_price}
        </div>
        <div className="col-span-2">
          <span className="text-gray-600">Dates:</span> {formatDateRange(service.date_from, service.date_to)}
        </div>
        <div className="col-span-2">
          <span className="text-gray-600">Original Payer:</span> {service.payer_name}
        </div>
      </div>
      
      {/* Split Form */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Split into parts:</h3>
          <div className="flex gap-2">
            <button 
              onClick={handleDivideEqually}
              className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 
                       border border-blue-300 rounded hover:bg-blue-50"
            >
              Divide Equally
            </button>
            <button 
              onClick={handleAddPart}
              className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1
                       border border-blue-300 rounded hover:bg-blue-50"
            >
              + Add Part
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          {parts.map((part, idx) => (
            <div key={idx} className="p-3 border rounded-lg bg-white">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    #{idx + 1} Payer {idx === 0 && '(Original)'}
                  </label>
                  <DirectorySelect
                    value={part.payer_id}
                    onChange={(value) => updatePart(idx, 'payer_id', value)}
                    placeholder="Type to search..."
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Client Price (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={part.client_price}
                    onChange={(e) => updatePart(idx, 'client_price', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Service Price (€) <span className="text-gray-400">(Auto)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={part.service_price}
                    disabled
                    className="w-full px-3 py-2 border rounded bg-gray-50"
                  />
                </div>
              </div>
              
              {parts.length > 1 && (
                <button
                  onClick={() => removePart(idx)}
                  className="mt-2 text-xs text-red-600 hover:text-red-800"
                >
                  Remove this part
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Totals */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between text-sm mb-1">
          <span>Total Client Price:</span>
          <span className={cn(
            "font-semibold",
            isValid ? "text-green-600" : "text-red-600"
          )}>
            €{totalClientPrice.toFixed(2)} 
            {isValid ? " ✅" : " ❌"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total Service Price:</span>
          <span className={cn(
            "font-semibold",
            isValid ? "text-green-600" : "text-red-600"
          )}>
            €{totalServicePrice.toFixed(2)}
            {isValid ? " ✅" : " ❌"}
          </span>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button
          onClick={onPrevious}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to Overview
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={onPrevious}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            &lt; Previous Service
          </button>
          <button
            onClick={onNext}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Next Service &gt;
          </button>
        </div>
        
        <button
          onClick={onApply}
          disabled={!isValid}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700
                   disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
    </div>
  );
};
```

---

## 9️⃣ SPLIT FOR 1 SERVICE

### **Требование:**
> "Split Form при 1 сервисе пусть работает так, как уже есть сейчас."

```tsx
// Если выбран только 1 сервис → открываем напрямую Split form (без Overview)
const handleSplitClick = () => {
  if (selectedServices.length === 1) {
    // Open simple split modal (current implementation)
    openSingleServiceSplitModal(selectedServices[0]);
  } else {
    // Open Overview + Tabs modal
    openMultiServiceSplitModal(selectedServices);
  }
};
```

---

## 🔟 ISSUE INVOICE — Откладываем

### **Требование:**
> "Сценарий: Issue Invoice для нескольких сервисов с разными плательщиками - пока отложим"

✅ Оставляем простую реализацию:
- Select services (☑️)
- [Issue Invoice] → создать один счет
- Если разные плательщики → показать warning, но не блокировать

---

## 📊 TESTING CHECKLIST

**После реализации проверить:**

### Functionality:
- [ ] Все 12 колонок отображаются корректно
- [ ] Client/Payer дублируются, если одинаковые
- [ ] Res Status по умолчанию `null` ("Not set")
- [ ] Cancel button появляется при hover
- [ ] Cancel меняет статус на "Cancelled" и делает строку серой
- [ ] Double-click на row открывает Edit modal
- [ ] Checklist Panel генерируется автоматически
- [ ] Split modal (1 service) работает как раньше
- [ ] Split modal (N services) показывает Overview + Tabs
- [ ] [Edit →] переключает на нужный таб
- [ ] Navigation (Previous/Next) работает в Split form
- [ ] [Apply] сохраняет split и возвращает в Overview
- [ ] [Apply Split (N)] создает split services в таблице

### UX:
- [ ] Hover effects работают (Cancel button, row highlight)
- [ ] Tabs переключаются плавно
- [ ] Checklist items кликабельны (toggle resolved)
- [ ] Split totals валидируются (✅ / ❌)
- [ ] Cancelled services визуально отличаются (серые)

### Performance:
- [ ] Table renders < 1s для 50+ services
- [ ] Modal opens < 300ms
- [ ] Tab switching instant

---

## 📎 RELATED FILES

**Files to modify:**
- `app/orders/[orderCode]/page.tsx`
- `app/orders/[orderCode]/_components/OrderServicesBlock.tsx`
- `app/orders/[orderCode]/_components/EditServiceModal.tsx`
- `app/orders/[orderCode]/_components/SplitServiceModal.tsx` (NEW)
- `app/orders/[orderCode]/_components/OrderClientSection.tsx` (add Checklist)

**API endpoints:**
- `PATCH /api/orders/[orderCode]/services/[serviceId]` (update res_status)
- `POST /api/orders/[orderCode]/services/split` (create split services)

---

**Prepared by:** UI System / Consistency  
**Status:** ✅ READY FOR CODE WRITER  
**Estimated Complexity:** 🔴 Complex (3-4 days)  
**Next Steps:** Code Writer implements → QA tests → Runner reviews

---

## 1️⃣1️⃣ EDIT SERVICE MODAL — Redesign (Вариант A: Компактный)

### **Текущие проблемы:**

1. ❌ Supplier/Client/Payer — длинные пустые dropdown'ы (занимают 60% высоты)
2. ❌ Нет визуальной группировки полей
3. ❌ Service Dates — непонятный формат
4. ❌ Нет validation hints (required fields)
5. ❌ Modal слишком высокий (нужен scroll)

---

### **Новый дизайн: Компактный layout с grouped cards**

```tsx
<Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Edit Service</DialogTitle>
    </DialogHeader>
    
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Basic Info Card */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Basic Info
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({...formData, category: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Flight">🛫 Flight</SelectItem>
                <SelectItem value="Hotel">🏨 Hotel</SelectItem>
                <SelectItem value="Transfer">🚗 Transfer</SelectItem>
                <SelectItem value="Tour">🗺️ Tour</SelectItem>
                <SelectItem value="Insurance">🛡️ Insurance</SelectItem>
                <SelectItem value="Visa">📄 Visa</SelectItem>
                <SelectItem value="Rent a Car">🚙 Rent a Car</SelectItem>
                <SelectItem value="Cruise">🚢 Cruise</SelectItem>
                <SelectItem value="Other">📦 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Status
            </label>
            <Select
              value={formData.res_status || ''}
              onValueChange={(value) => setFormData({...formData, res_status: value || null})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Not set</SelectItem>
                <SelectItem value="booked">✅ Booked</SelectItem>
                <SelectItem value="confirmed">✅ Confirmed</SelectItem>
                <SelectItem value="changed">🟡 Changed</SelectItem>
                <SelectItem value="rejected">🔴 Rejected</SelectItem>
                <SelectItem value="cancelled">🚫 Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Name */}
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g. RIX-DXB-RIX"
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        {/* Service Dates */}
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">
            Service Dates
          </label>
          <DateRangePicker
            value={[formData.date_from, formData.date_to]}
            onChange={handleDatesChange}
            placeholder="📅 Select dates"
            className="w-full"
          />
        </div>
      </div>
      
      {/* Pricing Card */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Pricing
        </h3>
        
        <div className="grid grid-cols-3 gap-4 items-end">
          {/* Service Price */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Service Price (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.service_price}
              onChange={(e) => setFormData({...formData, service_price: parseFloat(e.target.value)})}
              placeholder="0.00"
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Your cost</p>
          </div>
          
          {/* Client Price */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Client Price (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.client_price}
              onChange={(e) => setFormData({...formData, client_price: parseFloat(e.target.value)})}
              placeholder="0.00"
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Client pays</p>
          </div>
          
          {/* Margin (auto-calculated) */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Margin
            </label>
            <div className="px-3 py-2 bg-white border rounded h-[42px] flex items-center">
              <span className={cn(
                "font-semibold",
                margin > 0 ? "text-green-600" : "text-red-600"
              )}>
                €{margin.toFixed(2)}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({marginPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Parties Card */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Parties
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Supplier
            </label>
            <DirectoryCombobox
              value={formData.supplier_id}
              onChange={(value) => setFormData({...formData, supplier_id: value})}
              placeholder="Type to search..."
              filter={(item) => item.roles.includes('supplier')}
              allowEmpty
            />
            <p className="text-xs text-gray-500 mt-1">Optional</p>
          </div>
          
          {/* Client */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            <DirectoryCombobox
              value={formData.client_id}
              onChange={handleClientChange}
              placeholder="Select client"
              filter={(item) => item.roles.includes('client')}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Who travels</p>
          </div>
          
          {/* Payer */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Payer <span className="text-red-500">*</span>
            </label>
            <DirectoryCombobox
              value={formData.payer_id}
              onChange={(value) => setFormData({...formData, payer_id: value})}
              placeholder="Select payer"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Who pays</p>
          </div>
        </div>
      </div>
      
      {/* References Card */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          References
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Ref Nr */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Ref Nr
            </label>
            <input
              type="text"
              value={formData.ref_nr || ''}
              onChange={(e) => setFormData({...formData, ref_nr: e.target.value})}
              placeholder="e.g. ABC123"
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Booking reference</p>
          </div>
          
          {/* Ticket Nr */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Ticket Nr
            </label>
            <input
              type="text"
              value={formData.ticket_nr || ''}
              onChange={(e) => setFormData({...formData, ticket_nr: e.target.value})}
              placeholder="e.g. 1234567890123"
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">For flights/tours</p>
          </div>
        </div>
      </div>
    </form>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setEditModalOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} disabled={!isFormValid}>
        Save Service
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### **Key Features:**

1. ✅ **Grouped cards** — 4 секции (Basic Info, Pricing, Parties, References)
2. ✅ **Компактный layout** — все на одном экране (no scroll for typical cases)
3. ✅ **Required fields** — помечены красной звездочкой (*)
4. ✅ **Auto-calculated margin** — показывается справа от цен
5. ✅ **Autocomplete combobox** — для Supplier/Client/Payer (вместо длинных dropdown'ов)
6. ✅ **Smart hints** — текстовые подсказки под полями ("Your cost", "Who travels", etc)
7. ✅ **Visual feedback** — focus ring на активных полях
8. ✅ **Date range picker** — с календарем

---

### **DirectoryCombobox Component:**

```tsx
const DirectoryCombobox = ({ 
  value, 
  onChange, 
  placeholder, 
  filter,
  allowEmpty = false,
  required = false 
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const { data: directoryItems } = useQuery({
    queryKey: ['directory'],
    queryFn: fetchDirectory
  });
  
  const filteredItems = useMemo(() => {
    let items = directoryItems || [];
    
    // Apply role filter
    if (filter) {
      items = items.filter(filter);
    }
    
    // Apply search
    if (search) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.email?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    return items;
  }, [directoryItems, filter, search]);
  
  const selectedItem = directoryItems?.find(item => item.id === value);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 border rounded",
            "hover:bg-gray-50 focus:ring-2 focus:ring-blue-500",
            !value && "text-gray-400"
          )}
        >
          <span className="truncate">
            {selectedItem ? selectedItem.name : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput 
            placeholder="Type to search..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {allowEmpty && (
                <CommandItem
                  value=""
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <span className="text-gray-400">— Not selected —</span>
                </CommandItem>
              )}
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      {item.email && (
                        <div className="text-xs text-gray-500 truncate">
                          {item.email}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {item.roles.map(role => (
                        <span key={role} className="text-xs px-1 py-0.5 bg-gray-100 rounded">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
```

---

### **Smart Defaults Logic:**

```tsx
// При создании нового сервиса
const createNewService = (orderId: string) => {
  const order = getOrder(orderId);
  
  return {
    category: null,
    name: '',
    res_status: null,              // ❌ НЕ "Booked"
    date_from: null,
    date_to: null,
    service_price: 0,
    client_price: 0,
    supplier_id: null,
    client_id: order.client_id,    // ✅ Auto = order client
    payer_id: order.client_id,     // ✅ Auto = client (по умолчанию)
    ref_nr: null,
    ticket_nr: null,
  };
};

// Когда меняем Client → Payer тоже меняется (если Payer == старый Client)
const handleClientChange = (newClientId: string) => {
  setFormData(prev => ({
    ...prev,
    client_id: newClientId,
    // Если Payer был = старому Client → обновляем Payer тоже
    payer_id: prev.payer_id === prev.client_id ? newClientId : prev.payer_id
  }));
};
```

---

### **Margin Calculation:**

```tsx
const margin = formData.client_price - formData.service_price;
const marginPercent = formData.service_price > 0 
  ? (margin / formData.service_price) * 100 
  : 0;
```

---

### **Form Validation:**

```tsx
const isFormValid = 
  formData.category &&
  formData.name.trim() !== '' &&
  formData.service_price >= 0 &&
  formData.client_price >= 0 &&
  formData.client_id &&
  formData.payer_id;
```

---

### **Required Fields:**

| Field | Required | Notes |
|-------|----------|-------|
| Category | ✅ Yes | Must select from dropdown |
| Name | ✅ Yes | Must not be empty |
| Service Price | ✅ Yes | Can be 0 |
| Client Price | ✅ Yes | Can be 0 |
| Client | ✅ Yes | Who travels |
| Payer | ✅ Yes | Who pays |
| Status | ❌ No | По умолчанию `null` |
| Dates | ❌ No | Optional (но рекомендуется) |
| Supplier | ❌ No | Optional |
| Ref Nr | ❌ No | Optional |
| Ticket Nr | ❌ No | Optional |

---

### **Visual Comparison:**

**BEFORE (текущий):**
- Modal height: ~800px (нужен scroll)
- Wasted space: ~240px (пустые dropdown'ы)
- No grouping
- No validation hints

**AFTER (новый):**
- Modal height: ~650px (помещается на экран)
- Compact: все поля видны
- Clear grouping (4 cards)
- Required fields marked (*)
- Smart hints ("Your cost", "Who pays")

---

## 📊 TESTING CHECKLIST (дополнение)

**Edit Service Modal:**
- [ ] Все 4 секции отображаются (Basic Info, Pricing, Parties, References)
- [ ] Required fields помечены красной звездочкой (*)
- [ ] Margin вычисляется автоматически
- [ ] DirectoryCombobox работает (type to search)
- [ ] Smart default: Client → Payer (если не менялся)
- [ ] Validation работает (нельзя save если не заполнены required)
- [ ] Date picker открывается и выбирает диапазон
- [ ] Hints показываются под полями
- [ ] Focus ring появляется на активных полях
- [ ] Modal помещается на экране (no scroll для стандартных случаев)

---

**Prepared by:** UI System / Consistency  
**Updated:** 2026-01-11 | 20:15  
**Status:** ✅ COMPLETE — Ready for Code Writer
