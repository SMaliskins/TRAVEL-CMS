# Code Writer Task: Fix Profit & Orders Chart - Future Dates Forecast

**Дата:** 2026-01-08
**Приоритет:** HIGH (Bug Fix)
**Статус:** PENDING

---

## Проблема

Календарь Profit & Orders на Dashboard не должен показывать фактические данные для дней, которые больше сегодняшнего дня. Сейчас линии рисуются как сплошные для всего месяца, что вводит в заблуждение.

## Требования

### 1. Разделение данных на "Факт" и "Прогноз"

- **Факт (Actual):** Дни от начала периода до сегодня включительно
  - Сплошная линия (как сейчас)
  - Реальные данные из БД

- **Прогноз (Forecast):** Дни после сегодня до конца месяца
  - **Пунктирная линия** (`strokeDasharray`)
  - Значения = средние значения за аналогичные дни прошлых лет

### 2. Расчет прогноза

```typescript
// Для каждого будущего дня (например, 15 января 2026):
// 1. Найти данные за 15 января 2025, 2024, 2023...
// 2. Рассчитать среднее значение profit и orders
// 3. Использовать как прогноз

forecastValue = average(historicalValues for same day in previous years)
```

### 3. Визуальное отображение

- Сплошная линия до сегодня (включительно)
- Вертикальная пунктирная линия на сегодняшней дате (уже есть)
- Пунктирная линия для прогноза после сегодня
- Заливка под прогнозом - более прозрачная или с другим паттерном

### 4. Легенда

Добавить в легенду:
- "Profit (actual)" - красная сплошная
- "Profit (forecast)" - красная пунктирная
- "Orders (actual)" - синяя сплошная  
- "Orders (forecast)" - синяя пунктирная

---

## Файлы для изменения

1. **`components/dashboard/ProfitOrdersChart.tsx`**
   - Разделить данные на actual/forecast по `currentDateIndex`
   - Создать отдельные пути для actual (solid) и forecast (dashed)
   - Обновить легенду

2. **`app/dashboard/page.tsx`** (или API)
   - Добавить загрузку исторических данных для расчета прогноза
   - Передать данные прогноза в компонент

3. **`app/api/dashboard/route.ts`** (если есть)
   - Добавить endpoint или логику для получения средних значений за прошлые годы

---

## Техническая реализация

### Шаг 1: Разделение путей в ProfitOrdersChart

```typescript
// Разделить данные
const actualData = data.slice(0, currentDateIndex + 1);
const forecastData = data.slice(currentDateIndex); // Включает сегодня для соединения

// Создать пути
const actualProfitPath = createSmoothPath(actualProfitValues);
const forecastProfitPath = createSmoothPath(forecastProfitValues);

// Рендер
<path d={actualProfitPath} stroke="#ef4444" strokeWidth="2.5" />
<path d={forecastProfitPath} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="8 4" />
```

### Шаг 2: Расчет прогноза (API или frontend)

```typescript
// Для каждого будущего дня
const getForecastForDay = async (month: number, day: number): Promise<{profit: number, orders: number}> => {
  // Получить данные за этот день за последние N лет
  const historicalData = await supabase
    .from('orders')
    .select('profit, created_at')
    .filter('extract(month from created_at)', 'eq', month)
    .filter('extract(day from created_at)', 'eq', day);
  
  // Рассчитать среднее
  const avgProfit = historicalData.reduce((sum, d) => sum + d.profit, 0) / historicalData.length;
  return { profit: avgProfit, orders: avgOrders };
};
```

---

## Критерии приёмки

- [ ] Дни до сегодня отображаются сплошной линией (факт)
- [ ] Дни после сегодня отображаются пунктирной линией (прогноз)
- [ ] Прогноз рассчитывается как среднее за прошлые годы
- [ ] Легенда показывает разницу между фактом и прогнозом
- [ ] Визуально чётко видна граница "сегодня" между фактом и прогнозом
- [ ] При наведении на прогнозные дни tooltip показывает "(forecast)"

---

## Примечания

- Если исторических данных нет, использовать 0 или скрывать прогноз
- Прогноз не должен влиять на масштаб оси Y (или влиять минимально)
- Анимация перехода между месяцами должна работать корректно
