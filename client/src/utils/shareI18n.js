/*
 * The share-link page in English, Hindi, Kannada and Tamil, so the family can read the plan in their own
 * language. Room names the owner left as the defaults ("Bedroom 2", "Kitchen") are translated too; names
 * they typed themselves are shown as written. The owner can send a link that opens in a language
 * (`?lang=hi`), and the reader can switch at the top of the page.
 */
export const LANGUAGES = [['en', 'English'], ['hi', 'हिन्दी'], ['kn', 'ಕನ್ನಡ'], ['ta', 'தமிழ்']];

const T = {
  en: {
    sharedPlan: 'SHARED PLAN', from: 'FROM {name}', untitled: 'Untitled home',
    approvedBy: 'Approved by {name}', changesBy: 'Changes requested by {name}', earlier: ' (an earlier version)',
    groundFloor: 'Ground floor', floorN: 'Floor {n}', ground: 'Ground',
    clickRoom: 'Click a room to comment on it.', buildProgress: 'Build progress', yourName: 'Your name',
    commentOn: 'Comment on {room}', commentOnPlan: 'Comment on the plan',
    placeholderRoom: 'What would you change in the {room}?', placeholderPlan: 'What do you think?',
    wholePlan: 'Comment on the whole plan instead', send: 'Send',
    yourDecision: 'Your decision', noteOptional: 'A note (optional)', approve: 'Approve plan', askChanges: 'Ask for changes',
    approvingRecords: 'Approving records this exact version of the plan.',
    comments: 'COMMENTS', noComments: 'No comments yet.', commentMeta: 'on {room}', done: 'done',
    addName: 'Add your name so the owner knows who wrote this.', linkUnavailable: "This link isn't available",
    whichOption: 'Which option do you prefer?', versions: '{n} versions of the house. Vote for one; you can change your vote any time.',
    bed: 'bed', bath: 'bath', floors: '{n} floors', voteFor: 'Vote for this', yourVote: 'Your vote',
    why: 'Why? (optional, sent with your vote)', language: 'Language',
  },
  hi: {
    sharedPlan: 'साझा नक्शा', from: 'भेजने वाले: {name}', untitled: 'बिना नाम का घर',
    approvedBy: '{name} ने मंज़ूरी दी', changesBy: '{name} ने बदलाव माँगे', earlier: ' (पिछला संस्करण)',
    groundFloor: 'भूतल', floorN: 'मंज़िल {n}', ground: 'भूतल',
    clickRoom: 'किसी कमरे पर टिप्पणी करने के लिए उस पर क्लिक करें।', buildProgress: 'निर्माण की प्रगति', yourName: 'आपका नाम',
    commentOn: '{room} पर टिप्पणी', commentOnPlan: 'नक्शे पर टिप्पणी',
    placeholderRoom: '{room} में आप क्या बदलना चाहेंगे?', placeholderPlan: 'आपकी क्या राय है?',
    wholePlan: 'इसके बजाय पूरे नक्शे पर टिप्पणी करें', send: 'भेजें',
    yourDecision: 'आपका फ़ैसला', noteOptional: 'नोट (वैकल्पिक)', approve: 'नक्शा मंज़ूर करें', askChanges: 'बदलाव माँगें',
    approvingRecords: 'मंज़ूरी नक्शे के इसी संस्करण के लिए दर्ज होती है।',
    comments: 'टिप्पणियाँ', noComments: 'अभी कोई टिप्पणी नहीं।', commentMeta: '{room} पर', done: 'पूरा',
    addName: 'अपना नाम लिखें, ताकि मालिक जान सकें कि यह किसने लिखा।', linkUnavailable: 'यह लिंक उपलब्ध नहीं है',
    whichOption: 'आपको कौन-सा विकल्प पसंद है?', versions: 'घर के {n} संस्करण। किसी एक को वोट दें; आप अपना वोट कभी भी बदल सकते हैं।',
    bed: 'बेडरूम', bath: 'बाथरूम', floors: '{n} मंज़िलें', voteFor: 'इसे वोट दें', yourVote: 'आपका वोट',
    why: 'क्यों? (वैकल्पिक, वोट के साथ भेजा जाएगा)', language: 'भाषा',
  },
  kn: {
    sharedPlan: 'ಹಂಚಿಕೊಂಡ ನಕ್ಷೆ', from: '{name} ಅವರಿಂದ', untitled: 'ಹೆಸರಿಲ್ಲದ ಮನೆ',
    approvedBy: '{name} ಅನುಮೋದಿಸಿದ್ದಾರೆ', changesBy: '{name} ಬದಲಾವಣೆ ಕೇಳಿದ್ದಾರೆ', earlier: ' (ಹಿಂದಿನ ಆವೃತ್ತಿ)',
    groundFloor: 'ನೆಲ ಮಹಡಿ', floorN: 'ಮಹಡಿ {n}', ground: 'ನೆಲ ಮಹಡಿ',
    clickRoom: 'ಕೋಣೆಯ ಬಗ್ಗೆ ಅಭಿಪ್ರಾಯ ಬರೆಯಲು ಅದರ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ.', buildProgress: 'ನಿರ್ಮಾಣದ ಪ್ರಗತಿ', yourName: 'ನಿಮ್ಮ ಹೆಸರು',
    commentOn: '{room} ಬಗ್ಗೆ ಅಭಿಪ್ರಾಯ', commentOnPlan: 'ನಕ್ಷೆಯ ಬಗ್ಗೆ ಅಭಿಪ್ರಾಯ',
    placeholderRoom: '{room}: ನೀವು ಏನನ್ನು ಬದಲಾಯಿಸಲು ಬಯಸುತ್ತೀರಿ?', placeholderPlan: 'ನಿಮ್ಮ ಅಭಿಪ್ರಾಯವೇನು?',
    wholePlan: 'ಬದಲಿಗೆ ಇಡೀ ನಕ್ಷೆಯ ಬಗ್ಗೆ ಬರೆಯಿರಿ', send: 'ಕಳುಹಿಸಿ',
    yourDecision: 'ನಿಮ್ಮ ನಿರ್ಧಾರ', noteOptional: 'ಟಿಪ್ಪಣಿ (ಐಚ್ಛಿಕ)', approve: 'ನಕ್ಷೆಯನ್ನು ಅನುಮೋದಿಸಿ', askChanges: 'ಬದಲಾವಣೆ ಕೇಳಿ',
    approvingRecords: 'ಅನುಮೋದನೆಯು ನಕ್ಷೆಯ ಇದೇ ಆವೃತ್ತಿಗೆ ದಾಖಲಾಗುತ್ತದೆ.',
    comments: 'ಅಭಿಪ್ರಾಯಗಳು', noComments: 'ಇನ್ನೂ ಯಾವುದೇ ಅಭಿಪ್ರಾಯಗಳಿಲ್ಲ.', commentMeta: '{room} ಬಗ್ಗೆ', done: 'ಮುಗಿದಿದೆ',
    addName: 'ಯಾರು ಬರೆದರು ಎಂದು ಮಾಲೀಕರಿಗೆ ತಿಳಿಯಲು ನಿಮ್ಮ ಹೆಸರನ್ನು ಸೇರಿಸಿ.', linkUnavailable: 'ಈ ಲಿಂಕ್ ಲಭ್ಯವಿಲ್ಲ',
    whichOption: 'ನಿಮಗೆ ಯಾವ ಆಯ್ಕೆ ಇಷ್ಟ?', versions: 'ಮನೆಯ {n} ಆವೃತ್ತಿಗಳು. ಒಂದಕ್ಕೆ ಮತ ನೀಡಿ; ನಿಮ್ಮ ಮತವನ್ನು ಯಾವಾಗ ಬೇಕಾದರೂ ಬದಲಾಯಿಸಬಹುದು.',
    bed: 'ಬೆಡ್‌ರೂಮ್', bath: 'ಬಾತ್‌ರೂಮ್', floors: '{n} ಮಹಡಿಗಳು', voteFor: 'ಇದಕ್ಕೆ ಮತ ನೀಡಿ', yourVote: 'ನಿಮ್ಮ ಮತ',
    why: 'ಏಕೆ? (ಐಚ್ಛಿಕ, ಮತದೊಂದಿಗೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ)', language: 'ಭಾಷೆ',
  },
  ta: {
    sharedPlan: 'பகிரப்பட்ட வரைபடம்', from: '{name} அனுப்பியது', untitled: 'பெயரிடப்படாத வீடு',
    approvedBy: '{name} ஒப்புதல் அளித்தார்', changesBy: '{name} மாற்றங்கள் கேட்டார்', earlier: ' (முந்தைய பதிப்பு)',
    groundFloor: 'தரைத்தளம்', floorN: 'தளம் {n}', ground: 'தரைத்தளம்',
    clickRoom: 'ஒரு அறையைப் பற்றி கருத்து எழுத அதைக் கிளிக் செய்யவும்.', buildProgress: 'கட்டுமான முன்னேற்றம்', yourName: 'உங்கள் பெயர்',
    commentOn: '{room} பற்றிய கருத்து', commentOnPlan: 'வரைபடம் பற்றிய கருத்து',
    placeholderRoom: '{room}: நீங்கள் என்ன மாற்ற விரும்புகிறீர்கள்?', placeholderPlan: 'உங்கள் கருத்து என்ன?',
    wholePlan: 'பதிலாக முழு வரைபடம் பற்றி எழுதுங்கள்', send: 'அனுப்பு',
    yourDecision: 'உங்கள் முடிவு', noteOptional: 'குறிப்பு (விருப்பத்தேர்வு)', approve: 'வரைபடத்தை ஒப்புக்கொள்', askChanges: 'மாற்றங்கள் கேள்',
    approvingRecords: 'ஒப்புதல் இந்த வரைபடப் பதிப்புக்கே பதிவு செய்யப்படும்.',
    comments: 'கருத்துகள்', noComments: 'இன்னும் கருத்துகள் இல்லை.', commentMeta: '{room} பற்றி', done: 'முடிந்தது',
    addName: 'யார் எழுதினார் என்று உரிமையாளருக்குத் தெரிய உங்கள் பெயரைச் சேர்க்கவும்.', linkUnavailable: 'இந்த இணைப்பு கிடைக்கவில்லை',
    whichOption: 'உங்களுக்கு எந்த விருப்பம் பிடிக்கும்?', versions: 'வீட்டின் {n} பதிப்புகள். ஒன்றுக்கு வாக்களியுங்கள்; உங்கள் வாக்கை எப்போது வேண்டுமானாலும் மாற்றலாம்.',
    bed: 'படுக்கையறை', bath: 'குளியலறை', floors: '{n} தளங்கள்', voteFor: 'இதற்கு வாக்களி', yourVote: 'உங்கள் வாக்கு',
    why: 'ஏன்? (விருப்பத்தேர்வு, வாக்குடன் அனுப்பப்படும்)', language: 'மொழி',
  },
};

const ROOMS = {
  hi: { living: 'लिविंग रूम', dining: 'डाइनिंग रूम', kitchen: 'रसोई', master_bedroom: 'मास्टर बेडरूम', bedroom: 'बेडरूम', bathroom: 'बाथरूम',
    study: 'स्टडी रूम', utility: 'यूटिलिटी', closet: 'वॉक-इन अलमारी', lounge: 'फ़ैमिली लाउंज', hallway: 'गलियारा', corridor: 'गलियारा', balcony: 'बालकनी',
    patio: 'आँगन', terrace: 'छत', pooja: 'पूजा घर', store: 'स्टोर रूम', deck: 'डेक', foyer: 'प्रवेश कक्ष', powder: 'पाउडर रूम', guest: 'मेहमान कमरा' },
  kn: { living: 'ಹಾಲ್', dining: 'ಊಟದ ಕೋಣೆ', kitchen: 'ಅಡುಗೆಮನೆ', master_bedroom: 'ಮಾಸ್ಟರ್ ಬೆಡ್‌ರೂಮ್', bedroom: 'ಮಲಗುವ ಕೋಣೆ', bathroom: 'ಸ್ನಾನಗೃಹ',
    study: 'ಓದುವ ಕೋಣೆ', utility: 'ಯುಟಿಲಿಟಿ', closet: 'ಬಟ್ಟೆ ಕೋಣೆ', lounge: 'ಕುಟುಂಬದ ಲೌಂಜ್', hallway: 'ಹಜಾರ', corridor: 'ಹಜಾರ', balcony: 'ಬಾಲ್ಕನಿ',
    patio: 'ಅಂಗಳ', terrace: 'ತಾರಸಿ', pooja: 'ದೇವರ ಕೋಣೆ', store: 'ಉಗ್ರಾಣ', deck: 'ಡೆಕ್', foyer: 'ಪ್ರವೇಶ', powder: 'ಪೌಡರ್ ರೂಮ್', guest: 'ಅತಿಥಿ ಕೋಣೆ' },
  ta: { living: 'வரவேற்பறை', dining: 'சாப்பாட்டு அறை', kitchen: 'சமையலறை', master_bedroom: 'மாஸ்டர் படுக்கையறை', bedroom: 'படுக்கையறை', bathroom: 'குளியலறை',
    study: 'படிப்பறை', utility: 'யூட்டிலிட்டி', closet: 'உடை அறை', lounge: 'குடும்ப ஓய்வறை', hallway: 'நடைபாதை', corridor: 'நடைபாதை', balcony: 'பால்கனி',
    patio: 'முற்றம்', terrace: 'மொட்டை மாடி', pooja: 'பூஜை அறை', store: 'சேமிப்பு அறை', deck: 'டெக்', foyer: 'நுழைவாயில்', powder: 'பவுடர் அறை', guest: 'விருந்தினர் அறை' },
};

// the names the app gives rooms by default, so only those are translated
const DEFAULT_NAMES = {
  living: ['living room', 'living', 'hall'], dining: ['dining room', 'dining'], kitchen: ['kitchen'], master_bedroom: ['master bedroom', 'master suite', 'master'],
  bedroom: ['bedroom', 'kids bedroom', "kids' bedroom"], bathroom: ['bathroom', 'bath', 'attached bath', 'common bath', 'toilet', 'washroom'],
  study: ['study', 'study room', 'home office'], utility: ['utility', 'utility room', 'laundry'], closet: ['walk-in closet', 'closet', 'dressing'],
  lounge: ['family lounge', 'lounge', 'family room'], hallway: ['hallway', 'passage', 'corridor', 'lobby'], corridor: ['corridor', 'passage'],
  balcony: ['balcony'], patio: ['patio', 'sit-out'], terrace: ['terrace', 'roof terrace'], pooja: ['pooja room', 'pooja', 'puja room', 'prayer room'],
  store: ['store', 'store room', 'storage'], deck: ['deck'], foyer: ['foyer', 'entrance', 'entry'], powder: ['powder room', 'powder'], guest: ['guest room', 'guest bedroom'],
};

/** The chosen language: ?lang= in the link, then what the reader picked before, then the browser's. */
export function pickLanguage() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q && T[q]) return q;
    const saved = localStorage.getItem('archetech_share_lang');
    if (saved && T[saved]) return saved;
    const nav = (navigator.language || 'en').slice(0, 2);
    return T[nav] ? nav : 'en';
  } catch { return 'en'; }
}
export function rememberLanguage(lang) { try { localStorage.setItem('archetech_share_lang', lang); } catch { /* private mode */ } }

/** t('approvedBy', { name }) in the chosen language, falling back to English. */
export const translator = (lang) => (key, vars = {}) =>
  (T[lang]?.[key] ?? T.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

/** A room's name in the chosen language, when it still has its default name ("Bedroom 2" -> "बेडरूम 2"). */
export function roomName(room, lang) {
  if (!room || lang === 'en' || !ROOMS[lang]) return room?.name || '';
  const name = (room.name || '').trim();
  const m = name.match(/^(.*?)(?:\s*(\d+))?$/);
  const base = (m?.[1] || '').toLowerCase().trim(), num = m?.[2];
  const kind = Object.keys(DEFAULT_NAMES).find(k => DEFAULT_NAMES[k].includes(base));
  if (!kind || !ROOMS[lang][kind]) return name;
  return num ? `${ROOMS[lang][kind]} ${num}` : ROOMS[lang][kind];
}

/** A date in the chosen language. */
export const dateIn = (iso, lang) => (iso ? new Date(iso).toLocaleString({ en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN' }[lang] || undefined,
  { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
