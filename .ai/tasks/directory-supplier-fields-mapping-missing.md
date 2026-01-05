# Directory Supplier Fields Mapping Missing
**Priority:** CRITICAL  
**Type:** Bug Fix  
**Assigned to:** CODE WRITER  
**Status:** TODO

---

## 🔍 ПРОБЛЕМА

### Симптомы:
- Форма Directory имеет поля для Supplier commission (type, value, currency, valid_from, valid_to)
- Эти поля НЕ сохраняются в базу данных
- API не маппит эти поля из формы в базу данных
- Тип `SupplierDetails` не содержит commission полей

---

## 🔍 АНАЛИЗ МАППИНГА

### Что есть в форме (`DirectoryForm.tsx`):

**Supplier поля (строки 102-119):**
```typescript
const [supplierActivityArea, setSupplierActivityArea] = useState(...);
const [supplierCommissionType, setSupplierCommissionType] = useState<"percent" | "fixed">(...);
const [supplierCommissionValue, setSupplierCommissionValue] = useState<number | undefined>(...);
const [supplierCommissionCurrency, setSupplierCommissionCurrency] = useState("EUR");
const [supplierCommissionValidFrom, setSupplierCommissionValidFrom] = useState("");
const [supplierCommissionValidTo, setSupplierCommissionValidTo] = useState("");
```

**Форма отправляет (строка 398):**
```typescript
formData.supplierExtras = {
  activityArea: supplierActivityArea || undefined,
  // ❌ Commission поля НЕ отправляются!
};
```

### Что есть в типе (`lib/types/directory.ts`):

```typescript
export interface SupplierDetails {
  activityArea?: string;
  // ❌ Commission поля НЕ определены!
}
```

### Что есть в базе данных (`partner_party`):

**Согласно `.ai/DIRECTORY_FORM_DB_MAPPING.md` (строки 137-142):**
- ✅ `business_category` - маппится из `activityArea`
- ❌ `commission_type` - НЕ маппится
- ❌ `commission_value` - НЕ маппится
- ❌ `commission_currency` - НЕ маппится
- ❌ `commission_valid_from` - НЕ маппится
- ❌ `commission_valid_to` - НЕ маппится
- ❌ `commission_notes` - НЕ используется

### Что делает API:

**`app/api/directory/create/route.ts` (строки 202-216):**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { 
    party_id: partyId,
    partner_role: 'supplier' 
  };
  // ✅ Маппит только activityArea → business_category
  if (data.supplierExtras?.activityArea && validBusinessCategories.includes(...)) {
    supplierData.business_category = data.supplierExtras.activityArea;
  }
  // ❌ Commission поля НЕ маппятся!
}
```

**`app/api/directory/[id]/route.ts` (строки 397-411):**
```typescript
if (updates.roles.includes("supplier")) {
  const supplierData: any = { party_id: id, partner_role: 'supplier' };
  // ✅ Маппит только activityArea → business_category
  if (updates.supplierExtras?.activityArea && ...) {
    supplierData.business_category = updates.supplierExtras.activityArea;
  }
  // ❌ Commission поля НЕ маппятся!
}
```

**`app/api/directory/[id]/route.ts` (строки 62-66) - чтение:**
```typescript
// Supplier details
if (row.is_supplier && row.business_category) {
  record.supplierExtras = {
    activityArea: row.business_category,
    // ❌ Commission поля НЕ читаются из БД!
  };
}
```

---

## 🔧 ИСПРАВЛЕНИЕ

### 1. Обновить тип `SupplierDetails`

**Файл:** `lib/types/directory.ts`

**Текущий код:**
```typescript
export interface SupplierDetails {
  activityArea?: string;
}
```

**Заменить на:**
```typescript
export interface SupplierDetails {
  activityArea?: string;
  commissionType?: "percent" | "fixed";
  commissionValue?: number;
  commissionCurrency?: string;
  commissionValidFrom?: string; // ISO date string
  commissionValidTo?: string; // ISO date string
}
```

### 2. Обновить форму для отправки commission полей

**Файл:** `components/DirectoryForm.tsx`

**Найти (строка 398):**
```typescript
if (roles.includes("supplier")) {
  formData.supplierExtras = {
    activityArea: supplierActivityArea || undefined,
  };
}
```

**Заменить на:**
```typescript
if (roles.includes("supplier")) {
  formData.supplierExtras = {
    activityArea: supplierActivityArea || undefined,
    commissionType: supplierCommissionType || undefined,
    commissionValue: supplierCommissionValue || undefined,
    commissionCurrency: supplierCommissionCurrency || undefined,
    commissionValidFrom: supplierCommissionValidFrom || undefined,
    commissionValidTo: supplierCommissionValidTo || undefined,
  };
}
```

### 3. Обновить API CREATE для сохранения commission полей

**Файл:** `app/api/directory/create/route.ts`

**Найти (строки 202-216):**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { 
    party_id: partyId,
    partner_role: 'supplier' 
  };
  if (data.supplierExtras?.activityArea && validBusinessCategories.includes(data.supplierExtras.activityArea)) {
    supplierData.business_category = data.supplierExtras.activityArea;
  }
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
  ...
}
```

**Заменить на:**
```typescript
if (data.roles.includes("supplier")) {
  const supplierData: any = { 
    party_id: partyId,
    partner_role: 'supplier' 
  };
  // Map activityArea → business_category
  if (data.supplierExtras?.activityArea && validBusinessCategories.includes(data.supplierExtras.activityArea)) {
    supplierData.business_category = data.supplierExtras.activityArea;
  }
  // Map commission fields
  if (data.supplierExtras?.commissionType) {
    supplierData.commission_type = data.supplierExtras.commissionType;
  }
  if (data.supplierExtras?.commissionValue !== undefined) {
    supplierData.commission_value = data.supplierExtras.commissionValue;
  }
  if (data.supplierExtras?.commissionCurrency) {
    supplierData.commission_currency = data.supplierExtras.commissionCurrency;
  }
  if (data.supplierExtras?.commissionValidFrom) {
    supplierData.commission_valid_from = data.supplierExtras.commissionValidFrom;
  }
  if (data.supplierExtras?.commissionValidTo) {
    supplierData.commission_valid_to = data.supplierExtras.commissionValidTo;
  }
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
  ...
}
```

### 4. Обновить API UPDATE для сохранения commission полей

**Файл:** `app/api/directory/[id]/route.ts`

**Найти (строки 397-411):**
```typescript
if (updates.roles.includes("supplier")) {
  const supplierData: any = { party_id: id, partner_role: 'supplier' };
  if (updates.supplierExtras?.activityArea && validBusinessCategories.includes(...)) {
    supplierData.business_category = updates.supplierExtras.activityArea;
  }
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
  ...
}
```

**Заменить на:**
```typescript
if (updates.roles.includes("supplier")) {
  const supplierData: any = { party_id: id, partner_role: 'supplier' };
  // Map activityArea → business_category
  if (updates.supplierExtras?.activityArea && validBusinessCategories.includes(...)) {
    supplierData.business_category = updates.supplierExtras.activityArea;
  }
  // Map commission fields
  if (updates.supplierExtras?.commissionType) {
    supplierData.commission_type = updates.supplierExtras.commissionType;
  }
  if (updates.supplierExtras?.commissionValue !== undefined) {
    supplierData.commission_value = updates.supplierExtras.commissionValue;
  }
  if (updates.supplierExtras?.commissionCurrency) {
    supplierData.commission_currency = updates.supplierExtras.commissionCurrency;
  }
  if (updates.supplierExtras?.commissionValidFrom) {
    supplierData.commission_valid_from = updates.supplierExtras.commissionValidFrom;
  }
  if (updates.supplierExtras?.commissionValidTo) {
    supplierData.commission_valid_to = updates.supplierExtras.commissionValidTo;
  }
  const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
  ...
}
```

### 5. Обновить API GET для чтения commission полей

**Файл:** `app/api/directory/[id]/route.ts` и `app/api/directory/route.ts`

**Найти (строки 62-66):**
```typescript
// Supplier details
if (row.is_supplier && row.business_category) {
  record.supplierExtras = {
    activityArea: row.business_category,
  };
}
```

**Заменить на:**
```typescript
// Supplier details
if (row.is_supplier) {
  record.supplierExtras = {
    activityArea: row.business_category || undefined,
    commissionType: row.commission_type || undefined,
    commissionValue: row.commission_value ? parseFloat(row.commission_value) : undefined,
    commissionCurrency: row.commission_currency || undefined,
    commissionValidFrom: row.commission_valid_from || undefined,
    commissionValidTo: row.commission_valid_to || undefined,
  };
}
```

**Применить в двух местах:**
1. `app/api/directory/[id]/route.ts` - функция `buildDirectoryRecord` (строка 62)
2. `app/api/directory/route.ts` - функция `buildDirectoryRecord` (строка 62)

### 6. Обновить форму для загрузки commission полей из записи

**Файл:** `components/DirectoryForm.tsx`

**Найти (строки 102-119):**
```typescript
const [supplierActivityArea, setSupplierActivityArea] = useState(
  record?.supplierExtras?.activityArea || ""
);
const [supplierCommissionType, setSupplierCommissionType] = useState<"percent" | "fixed">(
  "percent"
);
const [supplierCommissionValue, setSupplierCommissionValue] = useState<number | undefined>(
  undefined
);
const [supplierCommissionCurrency, setSupplierCommissionCurrency] = useState(
  "EUR"
);
const [supplierCommissionValidFrom, setSupplierCommissionValidFrom] = useState(
  ""
);
const [supplierCommissionValidTo, setSupplierCommissionValidTo] = useState(
  ""
);
```

**Заменить на:**
```typescript
const [supplierActivityArea, setSupplierActivityArea] = useState(
  record?.supplierExtras?.activityArea || ""
);
const [supplierCommissionType, setSupplierCommissionType] = useState<"percent" | "fixed">(
  record?.supplierExtras?.commissionType || "percent"
);
const [supplierCommissionValue, setSupplierCommissionValue] = useState<number | undefined>(
  record?.supplierExtras?.commissionValue
);
const [supplierCommissionCurrency, setSupplierCommissionCurrency] = useState(
  record?.supplierExtras?.commissionCurrency || "EUR"
);
const [supplierCommissionValidFrom, setSupplierCommissionValidFrom] = useState(
  record?.supplierExtras?.commissionValidFrom || ""
);
const [supplierCommissionValidTo, setSupplierCommissionValidTo] = useState(
  record?.supplierExtras?.commissionValidTo || ""
);
```

**Также обновить useEffect для синхронизации (найти где синхронизируются supplier поля):**
```typescript
// В useEffect, где синхронизируются supplier поля
setSupplierActivityArea(record?.supplierExtras?.activityArea || "");
setSupplierCommissionType(record?.supplierExtras?.commissionType || "percent");
setSupplierCommissionValue(record?.supplierExtras?.commissionValue);
setSupplierCommissionCurrency(record?.supplierExtras?.commissionCurrency || "EUR");
setSupplierCommissionValidFrom(record?.supplierExtras?.commissionValidFrom || "");
setSupplierCommissionValidTo(record?.supplierExtras?.commissionValidTo || "");
```

---

## 📊 ВЛИЯНИЕ

### До исправления:
- ❌ Commission поля Supplier не сохраняются в базу данных
- ❌ Commission поля Supplier не загружаются из базы данных
- ❌ Пользователь вводит данные, но они теряются при сохранении
- ❌ Форма показывает пустые значения после загрузки

### После исправления:
- ✅ Commission поля Supplier сохраняются в базу данных
- ✅ Commission поля Supplier загружаются из базы данных
- ✅ Все данные Supplier корректно маппятся между формой, API и БД
- ✅ Пользователь видит сохраненные значения после загрузки

---

## ✅ КРИТЕРИИ ПРИЕМКИ

1. ✅ Тип `SupplierDetails` содержит все commission поля
2. ✅ Форма отправляет все commission поля в API
3. ✅ API CREATE сохраняет все commission поля в БД
4. ✅ API UPDATE сохраняет все commission поля в БД
5. ✅ API GET читает все commission поля из БД
6. ✅ Форма загружает все commission поля из записи
7. ✅ После сохранения и перезагрузки все commission поля отображаются корректно

---

## 🧪 ТЕСТИРОВАНИЕ

### Шаги для проверки:
1. Создать новую запись с ролью Supplier
2. Заполнить все commission поля (type, value, currency, valid_from, valid_to)
3. Сохранить запись
4. Открыть запись снова → все commission поля должны быть заполнены
5. Изменить commission поля → сохранить → проверить, что изменения сохранились

### Ожидаемый результат:
- Все commission поля Supplier сохраняются и загружаются корректно
- Маппинг работает: форма ↔ API ↔ БД

---

## 📝 ПРИМЕЧАНИЯ

- **Важно:** Проверить, что типы данных соответствуют БД:
  - `commission_type`: 'percent' | 'fixed' (CHECK constraint)
  - `commission_value`: numeric
  - `commission_currency`: text
  - `commission_valid_from`: date
  - `commission_valid_to`: date

- **Важно:** При чтении из БД нужно правильно парсить типы:
  - `commission_value` может быть numeric → нужно parseFloat
  - Даты могут быть в разных форматах

- **Важно:** При записи в БД нужно правильно форматировать:
  - Даты должны быть в формате ISO или DATE
  - Числа должны быть numeric, не string

---

**Created by:** QA Agent  
**Date:** 2025-12-25  
**Related:** DIRECTORY_FORM_DB_MAPPING.md, Directory Supplier Fields

