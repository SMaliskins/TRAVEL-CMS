# Passport Parser (NO AI)

Regex-based parser for Ukrainian and EU passports. Extracts data from PDF text.

## Supported Fields

| Field | Ukrainian Label | English Label | Format | Example |
|-------|-----------------|---------------|--------|---------|
| Surname | Прізвище | Surname | КИРИЛЛИЦА/LATIN | ЯНЧЕНКО/IANCHENKO → IANCHENKO |
| Given name | Ім'я | Given name | КИРИЛЛИЦА/LATIN | ІРИНА/IRYNA → IRYNA |
| Date of birth | Дата народження | Date of birth | DD МММ/MMM YY | 08 СІЧ/JAN 80 → 1980-01-08 |
| Date of issue | Дата видачі | Date of issue | DD МММ/MMM YY | 07 ЛЮТ/FEB 18 → 2018-02-07 |
| Date of expiry | Дата закінчення | Date of expiry | DD МММ/MMM YY | 07 ЛЮТ/FEB 28 → 2028-02-07 |
| Personal code | Запис № | Record No. | XXXXXXXX-XXXXX | 19800108-00720 |
| Passport No | Номер паспорта | Passport No. | 2 letters + 6-7 digits | FL652510 |

## Logic

- **Names**: Always extracts LATIN part after `/` (ЯНЧЕНКО/IANCHENKO → IANCHENKO)
- **Dates**: Ukrainian format DD СІЧ/JAN 80, validates DOB < Issue < Expiry
- **Swapped dates fix**: If PDF extraction puts values in wrong order, parser swaps DOB ↔ Issue when DOB > Issue
- **DOB > 2010 fix**: Uses oldest date (DOB from personalCode 19800108-00720)
- **Personal code**: 19800108-00720 (first 8 digits = YYYYMMDD birth date)

## Test

```bash
npm run test:passport
```
