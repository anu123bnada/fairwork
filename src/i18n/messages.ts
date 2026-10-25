// Message catalog. English is the source of truth and defines every key; other locales may omit
// keys and fall back to English. Sinhala, Tamil and German strings here are machine-assisted drafts
// that have NOT been reviewed by native speakers (see docs/ORYQEN_LOCALIZATION.md).
export const en = {
  "nav.home": "Home",
  "nav.check": "Check",
  "nav.record": "Record",
  "nav.passport": "Passport",
  "settings.title": "Settings",
  "settings.subtitle": "Manage your account",
  "settings.language": "Language",
  "settings.languageHelp": "Choose the language for translated screens. Screens without a translation stay in English.",
  "language.heading": "Choose your language",
  "language.continue": "Continue",
  "language.selected": "{language} selected. Navigation, settings and the newer panels are translated; other screens stay in English until their translations are reviewed.",
  "language.reviewNote": "Translations are drafts awaiting review by native speakers.",
  "language.coverageNote": "Only {count} interface strings are translated so far; most screens remain in English.",
  "research.title": "Research an employer",
  "research.companyName": "Company name",
  "research.country": "Country",
  "research.search": "Search registry",
  "employment.title": "Employment history",
  "skills.title": "Self-reported skills (unverified)",
  "team.title": "Organization team",
  "analysis.title": "Saved analysis history",
  "analysis.save": "Save this analysis",
} as const;
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export const si: Partial<Messages> = {
  "nav.home": "මුල් පිටුව", "nav.check": "පරීක්ෂා කරන්න", "nav.record": "වාර්තා", "nav.passport": "පාස්පෝර්ට්",
  "settings.title": "සැකසුම්", "settings.subtitle": "ඔබගේ ගිණුම කළමනාකරණය කරන්න", "settings.language": "භාෂාව",
  "settings.languageHelp": "පරිවර්තනය කළ තිර සඳහා භාෂාව තෝරන්න. පරිවර්තනයක් නොමැති තිර ඉංග්‍රීසියෙන් පවතී.",
  "language.heading": "ඔබේ භාෂාව තෝරන්න", "language.continue": "ඉදිරියට",
  "language.selected": "{language} තෝරාගෙන ඇත. සංචාලනය, සැකසුම් සහ නව පැනල පරිවර්තනය කර ඇත; අනෙක් තිර පරිවර්තන සමාලෝචනය කරන තෙක් ඉංග්‍රීසියෙන් පවතී.",
  "language.reviewNote": "පරිවර්තන යනු මව් භාෂාව කතා කරන්නන්ගේ සමාලෝචනය බලාපොරොත්තුවෙන් සිටින කෙටුම්පත් වේ.",
  "language.coverageNote": "මෙතෙක් පරිවර්තනය කර ඇත්තේ අතුරුමුහුණත් පාඨ {count} ක් පමණි; බොහෝ තිර තවමත් ඉංග්‍රීසියෙන් පවතී.",
  "research.title": "සේවායෝජකයෙකු පිළිබඳව පර්යේෂණය කරන්න", "research.companyName": "සමාගමේ නම", "research.country": "රට", "research.search": "ලේඛනය සොයන්න",
  "employment.title": "රැකියා ඉතිහාසය", "skills.title": "ස්වයං-වාර්තා කළ කුසලතා (සත්‍යාපනය නොකළ)", "team.title": "සංවිධාන කණ්ඩායම",
  "analysis.title": "සුරකින ලද විශ්ලේෂණ ඉතිහාසය", "analysis.save": "මෙම විශ්ලේෂණය සුරකින්න",
};
export const ta: Partial<Messages> = {
  "nav.home": "முகப்பு", "nav.check": "சரிபார்", "nav.record": "பதிவு", "nav.passport": "கடவுச்சீட்டு",
  "settings.title": "அமைப்புகள்", "settings.subtitle": "உங்கள் கணக்கை நிர்வகிக்கவும்", "settings.language": "மொழி",
  "settings.languageHelp": "மொழிபெயர்க்கப்பட்ட திரைகளுக்கான மொழியைத் தேர்ந்தெடுக்கவும். மொழிபெயர்ப்பு இல்லாத திரைகள் ஆங்கிலத்திலேயே இருக்கும்.",
  "language.heading": "உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்", "language.continue": "தொடரவும்",
  "language.selected": "{language} தேர்ந்தெடுக்கப்பட்டது. வழிசெலுத்தல், அமைப்புகள் மற்றும் புதிய பேனல்கள் மொழிபெயர்க்கப்பட்டுள்ளன; மற்ற திரைகள் மதிப்பாய்வு செய்யப்படும் வரை ஆங்கிலத்திலேயே இருக்கும்.",
  "language.reviewNote": "மொழிபெயர்ப்புகள் தாய்மொழி பேசுபவர்களின் மதிப்பாய்வுக்காகக் காத்திருக்கும் வரைவுகள்.",
  "language.coverageNote": "இதுவரை {count} இடைமுக உரைகள் மட்டுமே மொழிபெயர்க்கப்பட்டுள்ளன; பெரும்பாலான திரைகள் ஆங்கிலத்திலேயே உள்ளன.",
  "research.title": "ஒரு முதலாளியைப் பற்றி ஆய்வு செய்யுங்கள்", "research.companyName": "நிறுவனத்தின் பெயர்", "research.country": "நாடு", "research.search": "பதிவேட்டில் தேடு",
  "employment.title": "வேலை வரலாறு", "skills.title": "சுயமாகத் தெரிவித்த திறன்கள் (சரிபார்க்கப்படாதவை)", "team.title": "நிறுவனக் குழு",
  "analysis.title": "சேமித்த பகுப்பாய்வு வரலாறு", "analysis.save": "இந்தப் பகுப்பாய்வைச் சேமிக்கவும்",
};
export const de: Partial<Messages> = {
  "nav.home": "Startseite", "nav.check": "Prüfen", "nav.record": "Nachweise", "nav.passport": "Pass",
  "settings.title": "Einstellungen", "settings.subtitle": "Konto verwalten", "settings.language": "Sprache",
  "settings.languageHelp": "Wählen Sie die Sprache für übersetzte Bildschirme. Nicht übersetzte Bildschirme bleiben auf Englisch.",
  "language.heading": "Sprache wählen", "language.continue": "Weiter",
  "language.selected": "{language} ausgewählt. Navigation, Einstellungen und die neueren Bereiche sind übersetzt; andere Bildschirme bleiben auf Englisch, bis ihre Übersetzungen geprüft sind.",
  "language.reviewNote": "Die Übersetzungen sind Entwürfe, die noch von Muttersprachlern geprüft werden müssen.",
  "language.coverageNote": "Bisher sind nur {count} Oberflächentexte übersetzt; die meisten Bildschirme bleiben auf Englisch.",
  "research.title": "Arbeitgeber recherchieren", "research.companyName": "Firmenname", "research.country": "Land", "research.search": "Register durchsuchen",
  "employment.title": "Berufsverlauf", "skills.title": "Selbst angegebene Fähigkeiten (nicht verifiziert)", "team.title": "Organisationsteam",
  "analysis.title": "Gespeicherter Analyseverlauf", "analysis.save": "Diese Analyse speichern",
};
