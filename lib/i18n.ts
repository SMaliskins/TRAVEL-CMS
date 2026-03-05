/**
 * UI strings for interface language (My Profile > Language).
 * Use with useUserPreferences().prefs.language.
 * When adding new features, add strings here for en/ru/lv.
 */

export type UILang = "en" | "ru" | "lv";

const UI_STRINGS: Record<UILang, Record<string, string>> = {
  en: {
    // Profile page
    "profile.title": "My Profile",
    "profile.subtitle": "Your personal settings and preferences",
    "profile.profile": "Profile",
    "profile.personalInfo": "Personal Information",
    "profile.language": "Language",
    "profile.languageHint": "Interface language",
    "profile.changePassword": "Change Password",
    "profile.email": "Email",
    "profile.firstName": "First Name",
    "profile.lastName": "Last Name",
    "profile.phone": "Phone",
    "profile.saveChanges": "Save Changes",
    "profile.saving": "Saving...",
    "profile.updated": "Profile updated successfully!",
    "profile.currentPassword": "Current Password",
    "profile.newPassword": "New Password",
    "profile.confirmPassword": "Confirm Password",
    "profile.changePasswordBtn": "Change Password",
    "profile.changing": "Changing...",
    "profile.passwordChanged": "Password changed successfully!",
    "profile.minChars": "Minimum 8 characters",
    "profile.backToSettings": "Back to Settings",
    // Language names (for selector)
    "lang.en": "English",
    "lang.lv": "Latviešu",
    "lang.ru": "Русский",
  },
  ru: {
    "profile.title": "Мой профиль",
    "profile.subtitle": "Личные настройки",
    "profile.profile": "Профиль",
    "profile.personalInfo": "Личные данные",
    "profile.language": "Язык",
    "profile.languageHint": "Язык интерфейса",
    "profile.changePassword": "Сменить пароль",
    "profile.email": "Email",
    "profile.firstName": "Имя",
    "profile.lastName": "Фамилия",
    "profile.phone": "Телефон",
    "profile.saveChanges": "Сохранить",
    "profile.saving": "Сохранение…",
    "profile.updated": "Профиль обновлён!",
    "profile.currentPassword": "Текущий пароль",
    "profile.newPassword": "Новый пароль",
    "profile.confirmPassword": "Подтвердите пароль",
    "profile.changePasswordBtn": "Сменить пароль",
    "profile.changing": "Смена…",
    "profile.passwordChanged": "Пароль изменён!",
    "profile.minChars": "Минимум 8 символов",
    "profile.backToSettings": "Назад в настройки",
    "lang.en": "English",
    "lang.lv": "Latviešu",
    "lang.ru": "Русский",
  },
  lv: {
    "profile.title": "Mans profils",
    "profile.subtitle": "Jūsu personīgie iestatījumi",
    "profile.profile": "Profils",
    "profile.personalInfo": "Personīgā informācija",
    "profile.language": "Valoda",
    "profile.languageHint": "Saskarnes valoda",
    "profile.changePassword": "Mainīt paroli",
    "profile.email": "Email",
    "profile.firstName": "Vārds",
    "profile.lastName": "Uzvārds",
    "profile.phone": "Tālrunis",
    "profile.saveChanges": "Saglabāt",
    "profile.saving": "Saglabā…",
    "profile.updated": "Profils atjaunināts!",
    "profile.currentPassword": "Pašreizējā parole",
    "profile.newPassword": "Jaunā parole",
    "profile.confirmPassword": "Apstiprināt paroli",
    "profile.changePasswordBtn": "Mainīt paroli",
    "profile.changing": "Maina…",
    "profile.passwordChanged": "Parole mainīta!",
    "profile.minChars": "Vismaz 8 rakstzīmes",
    "profile.backToSettings": "Atpakaļ uz Iestatījumiem",
    "lang.en": "English",
    "lang.lv": "Latviešu",
    "lang.ru": "Русский",
  },
};

function normalizeLang(lang: string): UILang {
  if (lang === "ru" || lang === "lv") return lang;
  return "en";
}

/**
 * Get UI string by key for the given language.
 * Use from components that have access to useUserPreferences().prefs.language.
 */
export function t(lang: string, key: string): string {
  const L = normalizeLang(lang);
  return UI_STRINGS[L][key] ?? UI_STRINGS.en[key] ?? key;
}
