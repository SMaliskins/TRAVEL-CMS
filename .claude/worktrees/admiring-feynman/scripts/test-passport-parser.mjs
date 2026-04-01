#!/usr/bin/env node
/**
 * QA test for Ukrainian passport PDF parser
 * Run: node scripts/test-passport-parser.mjs
 */

import { parsePassportFromText } from "../lib/passport/parsePassportText.ts";

const TESTS = [
  {
    name: "Ukrainian passport (full)",
    text: `UKRAINE Type P Code UKR
Surname ЯНЧЕНКО/IANCHENKO
Given name ІРИНА/IRYNA
Nationality УКРАЇНА/UKRAINE
Date of birth 08 СІЧ/JAN 80
Record No. 19800108-00720
Sex F Place of birth ХАРКІВСЬКА ОБЛ./UKR
Date of issue 07 ЛЮТ/FEB 18
Date of expiry 07 ЛЮТ/FEB 28
Authority 6301
Passport No. FL652510`,
    expect: {
      passportNumber: "FL652510",
      firstName: "IRYNA",
      lastName: "IANCHENKO",
      dob: "1980-01-08",
      passportIssueDate: "2018-02-07",
      passportExpiryDate: "2028-02-07",
      personalCode: "19800108-00720",
      nationality: "UA",
    },
  },
  {
    name: "Swapped dates (PDF extraction bug)",
    text: "Surname X Given Y Date of birth 07 ЛЮТ/FEB 18 Date of issue 08 СІЧ/JAN 80 Date of expiry 07 ЛЮТ/FEB 28 Record No. 19800108-00720 Passport AB123456",
    expect: {
      dob: "1980-01-08",
      passportIssueDate: "2018-02-07",
      passportExpiryDate: "2028-02-07",
    },
  },
  {
    name: "Personal code from Record No",
    text: "Surname X Given Y Запис №/Record No. 19800108-00720 Passport AB123456",
    expect: { personalCode: "19800108-00720" },
  },
  {
    name: "DOB from personalCode fallback",
    text: "Surname X Given Y Record No. 19800108-00720 Passport AB123456",
    expect: { dob: "1980-01-08", personalCode: "19800108-00720" },
  },
];

let passed = 0;
let failed = 0;

for (const test of TESTS) {
  const result = parsePassportFromText(test.text);
  let ok = true;
  for (const [key, expected] of Object.entries(test.expect)) {
    const actual = result?.[key];
    if (actual !== expected) {
      console.error(`FAIL ${test.name}: ${key} = "${actual}" (expected "${expected}")`);
      ok = false;
    }
  }
  if (ok) {
    console.log(`PASS ${test.name}`);
    passed++;
  } else {
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
