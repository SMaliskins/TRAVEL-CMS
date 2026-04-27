import assert from "node:assert/strict";

import {
  getReleaseNewsText,
  normalizeReleaseNewsLanguage,
  RELEASE_NEWS_LANGUAGES,
} from "../lib/notifications/releaseNewsLanguage.ts";

assert.deepEqual(
  RELEASE_NEWS_LANGUAGES.map((item) => item.code),
  ["en", "ru", "lv"]
);

assert.equal(normalizeReleaseNewsLanguage("ru"), "ru");
assert.equal(normalizeReleaseNewsLanguage("de"), "en");
assert.equal(normalizeReleaseNewsLanguage(undefined), "en");

assert.equal(
  getReleaseNewsText({ en: "English news", ru: "Русские новости" }, "ru"),
  "Русские новости"
);
assert.equal(
  getReleaseNewsText({ en: "English news" }, "ru"),
  "English news"
);
assert.equal(
  getReleaseNewsText({ ru: "Русские новости" }, "en"),
  "Русские новости"
);

console.log("Release news language tests passed");
