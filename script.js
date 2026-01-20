import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {  getDatabase, ref, set, get, child, update, remove, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
const firebaseConfig = {
apiKey: "AIzaSyBqKewR4GWLeB0070uDT3NS5vL_h_vYCmM",
authDomain: "sader-e6d75.firebaseapp.com",
databaseURL: "https://sader-e6d75-default-rtdb.firebaseio.com",
projectId: "sader-e6d75",
storageBucket: "sader-e6d75.firebasestorage.app",
messagingSenderId: "330785701422",
appId: "1:330785701422:web:af5218f50d9be1c690e9bf",
measurementId: "G-20H2JMLLDP"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
let allData = [];
let booksMap = new Map();
let headersMap = new Map();
let booksOrder = [];
let booksArr = [];
let headersArr = [];
let bookNameToId = new Map();

// ===== الفهرست (TOC) =====
let TOC_MODE = 'books'; // 'books' | 'headers'
let TOC_CURRENT_PART = null;
let TOC_FROM_BOOKS_LIST = false;
let currentCategory = 'الكل';
let isDataLoaded = false;
let currentUser = null;
let userFavorites = new Set();
let isSignUpMode = false;
document.addEventListener('DOMContentLoaded', () => {
setupTheme();
setupEventListeners();
setTimeout(initializeData, 100);
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('dragstart', event => event.preventDefault());
});
function setupEventListeners() {
const favBtn = document.getElementById('favNavBtn');
if (favBtn) favBtn.addEventListener('click', openFavoritesModal);
const tocBtn = document.getElementById('tocBtn');
if (tocBtn) tocBtn.addEventListener('click', openTocModal);
const historyBtn = document.getElementById('historyNavBtn');
if (historyBtn) historyBtn.addEventListener('click', openHistoryModal);
const homeBtn = document.getElementById('homeNavBtn');
if (homeBtn) homeBtn.addEventListener('click', () => {
window.scrollTo({ top: 0, behavior: 'smooth' });
});
const googleBtn = document.getElementById('googleBtn');
if(googleBtn) googleBtn.addEventListener('click', handleGoogleLogin);
const emailForm = document.getElementById('emailForm');
if(emailForm) emailForm.addEventListener('submit', handleEmailAuth);
const toggleModeBtn = document.getElementById('toggleAuthMode');
if(toggleModeBtn) toggleModeBtn.addEventListener('click', toggleAuthMode);
const profileUpload = document.getElementById('profileUpload');
if(profileUpload) profileUpload.addEventListener('change', handleImageUpload);
onAuthStateChanged(auth, (user) => {
currentUser = user;
const userBtn = document.getElementById('userBtn');
const userAvatar = document.getElementById('userAvatar');
if (user) {
loadUserFavorites(user.uid);
if(document.getElementById('userNameDisplay'))
document.getElementById('userNameDisplay').innerText = user.displayName || "مستخدم جديد";
if(document.getElementById('userEmailDisplay'))
document.getElementById('userEmailDisplay').innerText = user.email;
loadUserProfileImage(user.uid);
userBtn.onclick = () => window.toggleProfileModal(true);
} else {
userFavorites.clear();
if(isDataLoaded) renderResults(allData.slice(0, 30));
if(userAvatar) userAvatar.src = `https://ui-avatars.com/api/?name=User&background=random`;
userBtn.onclick = () => window.toggleAuthModal(true);
}
});
const searchInput = document.getElementById('searchInput');
if (searchInput) {
const searchButton = document.getElementById('searchButton');
if (searchButton) searchButton.addEventListener('click', () => performSearch(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
if (e.key === 'Enter') {
e.preventDefault();
performSearch(searchInput.value);
}
});
let searchTimeout;
searchInput.addEventListener('input', (e) => {
const term = e.target.value;
clearTimeout(searchTimeout);
searchTimeout = setTimeout(() => {
if (term.length === 0 || term.trim().length >= 2) {
performSearch(term);
}
}, 800);
});
}
}
async function openFavoritesModal() {
if (!currentUser) {
window.toggleAuthModal(true);
return;
}
const backdrop = document.getElementById('favoritesBackdrop');
const sheet = document.getElementById('favoritesSheet');
const listContainer = document.getElementById('favoritesListContainer');
backdrop.classList.remove('hidden');
setTimeout(() => {
backdrop.classList.remove('opacity-0');
sheet.classList.remove('translate-y-full');
}, 10);
document.body.classList.add('overflow-hidden');
listContainer.innerHTML = `
<div class="flex flex-col items-center justify-center h-full text-slate-400">
<div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mb-3"></div>
<p class="text-sm">جاري جلب محفوظاتك...</p>
</div>
`;
try {
const snapshot = await get(ref(db, `users/${currentUser.uid}/favorites`));
if (snapshot.exists()) {
const dataObj = snapshot.val();
const favList = Object.values(dataObj).filter(item => item && item.title);
userFavorites = new Set(Object.keys(dataObj));
if (favList.length > 0) {
renderFavoritesList(favList, listContainer);
} else {
showEmptyFavState(listContainer);
}
} else {
userFavorites.clear();
showEmptyFavState(listContainer);
}
} catch (error) {
console.error(error);
listContainer.innerHTML = `<p class="text-red-500 text-center mt-10">حدث خطأ أثناء تحميل البيانات</p>`;
}
}
function renderFavoritesList(items, container) {
container.innerHTML = '';
items.forEach(item => {
const div = document.createElement('div');
div.className = 'bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex items-start gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors relative';
div.onclick = () => window.openModal(item);
const deleteBtn = document.createElement('button');
deleteBtn.className = 'absolute top-3 left-3 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors z-10';
deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
deleteBtn.onclick = (e) => {
e.stopPropagation();
toggleFavorite(item.id);
div.remove();
if(container.children.length === 0) showEmptyFavState(container);
};
div.innerHTML += `
<div class="mt-1 p-1.5 bg-white dark:bg-slate-700 rounded-lg text-primary-500 shadow-sm">
<i data-lucide="bookmark" class="w-4 h-4"></i>
</div>
<div class="flex-1">
<h4 class="font-headings font-bold text-slate-800 dark:text-white text-base mb-1 line-clamp-1">${item.title}</h4>
<p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${item.summary}</p>
</div>
`;
div.appendChild(deleteBtn);
container.appendChild(div);
});
if(window.lucide) window.lucide.createIcons();
}
function showEmptyFavState(container) {
container.innerHTML = `
<div class="flex flex-col items-center justify-center h-full text-slate-400 opacity-70">
<i data-lucide="heart-off" class="w-12 h-12 mb-2 text-slate-300 dark:text-slate-600"></i>
<p class="text-sm">لا توجد محفوظات</p>
</div>
`;
if(window.lucide) window.lucide.createIcons();
}
window.closeFavoritesModal = function() {
const backdrop = document.getElementById('favoritesBackdrop');
const sheet = document.getElementById('favoritesSheet');
backdrop.classList.add('opacity-0');
sheet.classList.add('translate-y-full');
setTimeout(() => {
backdrop.classList.add('hidden');
document.body.classList.remove('overflow-hidden');
}, 300);
};

// ===== نافذة الفهرست (TOC) =====
function getPartIdForCategory(categoryName) {
  if (!categoryName || categoryName === 'الكل') return null;
  if (bookNameToId.has(String(categoryName))) return bookNameToId.get(String(categoryName));
  const found = allData.find(it => it && it.category === categoryName && it.part != null && String(it.part) !== '');
  return found ? String(found.part) : null;
}

function getBookNameByPart(partId) {
  const name = booksMap.get(String(partId));
  if (name) return name;
  const found = allData.find(it => it && String(it.part) === String(partId) && it.category);
  return found ? found.category : String(partId);
}

function anyModalOpen() {
  const ids = ['modalBackdrop', 'favoritesBackdrop', 'historyBackdrop', 'profileModal', 'authModal', 'tocBackdrop'];
  return ids.some(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden') && !el.classList.contains('opacity-0');
  });
}

const escapeHtml = (s) => String(s ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function renderToc() {
  const titleEl = document.getElementById('tocTitle');
  const listEl = document.getElementById('tocList');
  const backBtn = document.getElementById('tocBackBtn');
  if (!titleEl || !listEl || !backBtn) return;

  // زر الرجوع يظهر فقط عند الدخول لوضع الأبواب من قائمة الكتب
  if (TOC_MODE === 'headers' && TOC_FROM_BOOKS_LIST) {
    backBtn.classList.remove('hidden');
  } else {
    backBtn.classList.add('hidden');
  }

  if (TOC_MODE === 'books') {
    titleEl.textContent = 'فهرست جميع الكتب';

    const countsByPart = {};
    allData.forEach(it => {
      const p = it?.part;
      if (p == null || String(p) === '') return;
      const key = String(p);
      countsByPart[key] = (countsByPart[key] || 0) + 1;
    });

    // ترتيب الكتب: إن وُجدت booksArr فنعتمدها، وإلا نعتمد تصنيفات البيانات
    let booksToShow = [];
    if (Array.isArray(booksArr) && booksArr.length) {
      booksToShow = booksArr
        .map(b => ({ id: String(b.id), name: String(b.name || '') }))
        .filter(b => b.name && countsByPart[b.id] != null);
    } else {
      const byCat = {};
      allData.forEach(it => {
        const name = it?.category;
        if (!name) return;
        byCat[name] = (byCat[name] || 0) + 1;
      });
      booksToShow = Object.keys(byCat).sort().map(name => ({ id: getPartIdForCategory(name) || name, name }));
      // احفظ العدادات بشكل موحد
      booksToShow.forEach(b => { if (countsByPart[b.id] == null) countsByPart[b.id] = byCat[b.name] || 0; });
    }

    if (!booksToShow.length) {
      listEl.innerHTML = `
        <div class="text-center text-sm text-slate-500 dark:text-slate-400 py-10">لا توجد فهارس متاحة</div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listEl.innerHTML = booksToShow.map(b => {
      const count = countsByPart[b.id] || 0;
      const partLabel = (b.id && b.id !== b.name) ? `الجزء: ${b.id}` : '';
      return `
        <button type="button" data-toc-part="${String(b.id)}" class="w-full text-right bg-white dark:bg-dark-card border border-gray-100 dark:border-slate-700 rounded-2xl p-4 hover:shadow-sm transition-all flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-headings font-bold text-slate-800 dark:text-slate-100 line-clamp-1">${escapeHtml(b.name)}</p>
            ${partLabel ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${partLabel}</p>` : ''}
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <span class="text-xs font-bold bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200 px-2.5 py-1 rounded-full">${count}</span>
            <i data-lucide="chevron-left" class="w-5 h-5 text-slate-400"></i>
          </div>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('[data-toc-part]').forEach(btn => {
      btn.addEventListener('click', () => {
        const part = btn.getAttribute('data-toc-part');
        TOC_MODE = 'headers';
        TOC_CURRENT_PART = part;
        TOC_FROM_BOOKS_LIST = true;
        renderToc();
      });
    });
  } else {
    const partId = TOC_CURRENT_PART;
    const bookName = partId ? getBookNameByPart(partId) : 'جميع الكتب';
    titleEl.textContent = `فهرست ${bookName}`;

    const pool = allData.filter(it => partId ? String(it.part) === String(partId) : true);
    const totalInPart = pool.length;

    const countsByHeader = {};
    pool.forEach(it => {
      const hid = it?.headerId;
      if (!hid) return;
      const key = String(hid);
      countsByHeader[key] = (countsByHeader[key] || 0) + 1;
    });

    let headersToShow = headersArr;
    if (partId) headersToShow = headersArr.filter(h => String(h.part) === String(partId));
    headersToShow = [...headersToShow].sort((a, b) => Number(a.anchorOrder || 0) - Number(b.anchorOrder || 0));

    const allItem = `
      <button type="button" data-toc-show-all="1" class="w-full text-right bg-white dark:bg-dark-card border border-gray-100 dark:border-slate-700 rounded-2xl p-4 hover:shadow-sm transition-all flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="font-headings font-bold text-primary-700 dark:text-primary-300">عرض جميع مسائل الكتاب</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(bookName)}</p>
        </div>
        <span class="text-xs font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 px-2.5 py-1 rounded-full">${totalInPart}</span>
      </button>
    `;

    if (!headersToShow.length) {
      listEl.innerHTML = allItem + `
        <div class="text-center text-sm text-slate-500 dark:text-slate-400 py-8">لا توجد أبواب مسجلة لهذا الكتاب</div>
      `;
    } else {
      listEl.innerHTML = allItem + headersToShow.map(h => {
        const hid = String(h.id);
        const count = countsByHeader[hid] || 0;
        return `
          <button type="button" data-toc-hid="${hid}" class="w-full text-right bg-white dark:bg-dark-card border border-gray-100 dark:border-slate-700 rounded-2xl p-4 hover:shadow-sm transition-all flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-bold text-amber-700 dark:text-amber-300 mb-0.5">الباب</p>
              <p class="font-headings font-bold text-slate-800 dark:text-slate-100 line-clamp-2">${escapeHtml(h.title || '')}</p>
            </div>
            <span class="text-xs font-bold bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200 px-2.5 py-1 rounded-full">${count}</span>
          </button>
        `;
      }).join('');
    }

    // عرض جميع المسائل
    const showAllBtn = listEl.querySelector('[data-toc-show-all]');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', () => {
        closeTocModal();
        if (partId) {
          const bn = getBookNameByPart(partId);
          window.filterCategory(bn, true);
        } else {
          window.filterCategory('الكل', true);
        }
      });
    }

    // فلترة حسب الباب
    listEl.querySelectorAll('[data-toc-hid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const hid = btn.getAttribute('data-toc-hid');
        closeTocModal();
        if (!partId) return;
        const bn = getBookNameByPart(partId);
        window.filterCategory(bn, true);
        const filtered = allData.filter(it => it && it.category === bn && String(it.headerId) === String(hid));
        renderResults(filtered.slice(0, 200));

        // إظهار عدّاد النتائج (نفس عنصر البحث) كإشارة للمستخدم
        const resultsCount = document.getElementById('resultsCount');
        const countValue = document.getElementById('countValue');
        if (countValue) countValue.innerText = filtered.length;
        if (resultsCount) resultsCount.classList.remove('hidden');
      });
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

function openTocModal() {
  if (!isDataLoaded) return;
  const backdrop = document.getElementById('tocBackdrop');
  const sheet = document.getElementById('tocSheet');
  if (!backdrop || !sheet) return;

  // حدّد وضع الفهرست بناءً على التصنيف الحالي
  const partId = getPartIdForCategory(currentCategory);
  if (currentCategory !== 'الكل' && partId) {
    TOC_MODE = 'headers';
    TOC_CURRENT_PART = partId;
    TOC_FROM_BOOKS_LIST = false;
  } else {
    TOC_MODE = 'books';
    TOC_CURRENT_PART = null;
    TOC_FROM_BOOKS_LIST = false;
  }

  backdrop.classList.remove('hidden');
  setTimeout(() => {
    backdrop.classList.remove('opacity-0');
    sheet.classList.remove('translate-y-full');
  }, 10);
  document.body.classList.add('overflow-hidden');
  renderToc();
}

window.closeTocModal = function() {
  const backdrop = document.getElementById('tocBackdrop');
  const sheet = document.getElementById('tocSheet');
  if (!backdrop || !sheet) return;
  backdrop.classList.add('opacity-0');
  sheet.classList.add('translate-y-full');
  setTimeout(() => {
    backdrop.classList.add('hidden');

    // إعادة تعيين الوضع
    TOC_MODE = 'books';
    TOC_CURRENT_PART = null;
    TOC_FROM_BOOKS_LIST = false;

    // لا ترفع القفل إن كان هناك نوافذ أخرى مفتوحة
    if (!anyModalOpen()) document.body.classList.remove('overflow-hidden');
  }, 300);
};

// زر الرجوع داخل الفهرست
document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('tocBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      TOC_MODE = 'books';
      TOC_CURRENT_PART = null;
      TOC_FROM_BOOKS_LIST = false;
      renderToc();
    });
  }
});

function initializeData() {
const loadingState = document.getElementById('loadingState');
if (typeof MasailData === 'undefined') {
if(loadingState) loadingState.innerHTML = '<p class="text-red-500">لم يتم العثور على ملف البيانات.</p>';
return;
}
try {
let rawEntries = [];
if (Array.isArray(MasailData)) rawEntries = MasailData;
else {
for (let key in MasailData) {
if (Array.isArray(MasailData[key]) && MasailData[key].length > 0) {
const firstItem = MasailData[key][0];
if (firstItem && (firstItem.hasOwnProperty('qa') || firstItem.hasOwnProperty('volume_name'))) {
rawEntries = MasailData[key];
break;
}
}
}
if (!rawEntries.length && MasailData.qa_entries) rawEntries = MasailData.qa_entries;
else if (!rawEntries.length && MasailData.data) rawEntries = MasailData.data;
}
if (!rawEntries || rawEntries.length === 0) throw new Error("بيانات فارغة");
// تهيئة الفهارس (الكتب/الأبواب) إن توفرت في ملف البيانات
try {
  const _books = Array.isArray(MasailData.books) ? MasailData.books : [];
  booksArr = _books;
  booksMap = new Map(_books.map(b => [String(b.id), b.name]));
  booksOrder = _books.map(b => b.name).filter(Boolean);
  bookNameToId = new Map(_books.filter(b => b && b.name != null).map(b => [String(b.name), String(b.id)]));

  const _headers = Array.isArray(MasailData.headers) ? MasailData.headers : [];
  headersArr = _headers;
  headersMap = new Map(_headers.map(h => [String(h.id), h]));
} catch (e) {
  booksArr = [];
  headersArr = [];
  booksMap = new Map();
  headersMap = new Map();
  booksOrder = [];
  bookNameToId = new Map();
}
allData = rawEntries.map((item, index) => {
  let questionText = "مسألة بدون عنوان";
  let answerText = "";
  if (item.qa && Array.isArray(item.qa) && item.qa.length > 0) {
    questionText = item.qa[0].q || questionText;
    answerText = item.qa[0].a || "";
  } else if (item.question || item.answer) {
    questionText = item.question || questionText;
    answerText = item.answer || "";
  } else if (item.q && item.a) {
    questionText = item.q;
    answerText = item.a;
  }

  const partStr = String(item.part ?? "");
  const bookName = booksMap.get(partStr) || item.volume_name || "عام";
  const hdr = headersMap.get(String(item.headerId || ""));
  const headerTitle = hdr && hdr.title ? hdr.title : "";
  const masalaNo = (item.displayOrder ?? item.order ?? null);


  const infoParts = [];
  if (bookName) infoParts.push(`الكتاب: ${bookName}`);
  if (item.part != null && item.part !== '') infoParts.push(`الجزء: ${item.part}`);
  if (masalaNo != null && masalaNo !== '') infoParts.push(`رقم المسألة: ${masalaNo}`);
  if (headerTitle) infoParts.push(`الباب: ${headerTitle}`);

  const cleanSummary = (answerText || "").replace(/\r\n|\n/g, ' ').trim();

  return {
    id: item.id || `q_${index}`,
    title: questionText,
    category: bookName,
    summary: (cleanSummary.substring(0, 85) + (cleanSummary.length > 85 ? '...' : '')),
    details: answerText || "",
    sourceInfo: infoParts.join(' | '),
    part: item.part ?? null,
    masalaNo,
    order: masalaNo,
    headerId: item.headerId || null,
    headerTitle
  };
});
isDataLoaded = true;
if(loadingState) loadingState.classList.add('hidden');
generateCategories();
renderResults(allData.slice(0, 30));
} catch (err) {
if(loadingState) loadingState.innerHTML = `<p class="text-red-500">خطأ: ${err.message}</p>`;
console.error(err);
}
}
function renderResults(data, highlightTerm = '') {
const container = document.getElementById('resultsContainer');
const emptyState = document.getElementById('emptyState');
container.innerHTML = '';
if (data.length === 0) {
if(emptyState) emptyState.classList.remove('hidden');
return;
} else {
if(emptyState) emptyState.classList.add('hidden');
}
const fragment = document.createDocumentFragment();
const sortedData = [...data].sort((a, b) => {
  const pa = Number(a.part || 0);
  const pb = Number(b.part || 0);
  if (pa !== pb) return pa - pb;
  return Number(a.order || 0) - Number(b.order || 0);
});
let lastPart = null;
let lastHeader = null;
let animIndex = 0;
sortedData.forEach((item) => {
  const partNow = item.part ?? null;

  // فاصل الجزء (يظهر فقط عند عرض الكل، لتجنب التكرار داخل نفس الكتاب)
  if (currentCategory === 'الكل' && partNow !== lastPart) {
    const partDiv = document.createElement('div');
    partDiv.className = 'md:col-span-2 col-span-1 px-4 py-3 rounded-2xl bg-slate-900/5 dark:bg-slate-700/30 border border-gray-100 dark:border-slate-700 flex items-center justify-between';
    partDiv.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="p-1.5 bg-white/70 dark:bg-slate-800 rounded-lg text-primary-500 shadow-sm">
          <i data-lucide="layers" class="w-4 h-4"></i>
        </div>
        <div>
          <p class="text-sm font-bold text-slate-800 dark:text-slate-100">${item.category || '—'}</p>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">الجزء: ${partNow ?? '—'}</p>
        </div>
      </div>`;
    fragment.appendChild(partDiv);
    lastHeader = null;
    lastPart = partNow;
  }

  // فاصل الباب/العنوان
  if (item.headerTitle && item.headerTitle !== lastHeader) {
    const hdrDiv = document.createElement('div');
    hdrDiv.className = 'md:col-span-2 col-span-1 px-4 py-3 rounded-2xl bg-white/60 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-700 flex items-center gap-2';
    hdrDiv.innerHTML = `
      <div class="p-1.5 bg-white dark:bg-slate-800 rounded-lg text-primary-500 shadow-sm">
        <i data-lucide="bookmark" class="w-4 h-4"></i>
      </div>
      <div class="flex-1">
        <p class="text-xs font-bold text-primary-600 dark:text-primary-400 mb-0.5">الباب</p>
        <p class="text-sm font-bold text-slate-800 dark:text-slate-100">${item.headerTitle}</p>
      </div>`;
    fragment.appendChild(hdrDiv);
    lastHeader = item.headerTitle;
  }

  const div = document.createElement('div');
  div.className = 'bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all group animate-slide-up relative';
  if (animIndex < 10) div.style.animationDelay = `${animIndex * 0.03}s`;
  const displayTitle = highlightTerm ? highlightText(item.title, highlightTerm) : item.title;
  const displaySummary = highlightTerm ? highlightText(item.summary, highlightTerm) : item.summary;
  const isFav = userFavorites.has(String(item.id));
  const heartClass = isFav ? 'fill-red-500 text-red-500' : 'text-slate-300 dark:text-slate-600 hover:text-red-400';
  const favBtn = document.createElement('button');
  favBtn.setAttribute('data-fav-btn-id', String(item.id));
  favBtn.className = `absolute top-5 left-5 z-10 p-2 rounded-full bg-slate-50 dark:bg-slate-800 transition-colors ${heartClass}`;
  favBtn.innerHTML = `<i data-lucide="heart" class="w-5 h-5 transition-colors"></i>`;
  favBtn.onclick = (e) => {
    e.stopPropagation();
    toggleFavorite(item.id);
  };

  const contentDiv = document.createElement('div');
  contentDiv.className = 'cursor-pointer';
  contentDiv.onclick = () => window.openModal(item);

  let iconName = 'book';
  const cat = item.category || '';
  if (cat.includes('صلاة') || cat.includes('صوم')) iconName = 'sun';
  else if (cat.includes('زكاة') || cat.includes('خمس')) iconName = 'coins';

  const extraLine = item.sourceInfo ? `<p class="mt-3 text-xs text-slate-400 dark:text-slate-500 line-clamp-2">${item.sourceInfo}</p>` : '';

  const numberBadge = (item.masalaNo != null && item.masalaNo !== '') ? `
      <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1 rounded-lg">
        <i data-lucide="hash" class="w-3.5 h-3.5 text-primary-500"></i>
        <span>رقم: ${item.masalaNo}</span>
      </span>
    ` : '';

  contentDiv.innerHTML = `
    <div class="flex items-start justify-between mb-3 pl-12">
      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700/50 px-2.5 py-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-slate-700">
          <i data-lucide="${iconName}" class="w-3.5 h-3.5 text-primary-500"></i>
          <span class="truncate max-w-[180px]">${item.category || "عام"}</span>
        </span>
        ${numberBadge}
      </div>
    </div>
    <h3 class="font-headings font-bold text-lg text-slate-800 dark:text-slate-100 mb-2 leading-tight">
      ${displayTitle}
    </h3>
    <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed overflow-hidden h-10 line-clamp-2">
      ${displaySummary}
    </p>
    ${extraLine}
  `;
  div.appendChild(favBtn);
  div.appendChild(contentDiv);
  fragment.appendChild(div);
  animIndex++;
});
container.appendChild(fragment);
if(window.lucide) window.lucide.createIcons();
}
async function toggleFavorite(itemId) {
if (!currentUser) {
window.toggleAuthModal(true);
return;
}
const itemIdStr = String(itemId);
const itemFullData = allData.find(i => String(i.id) === itemIdStr);
const favRef = ref(db, `users/${currentUser.uid}/favorites/${itemIdStr}`);
if (userFavorites.has(itemIdStr)) {
userFavorites.delete(itemIdStr);
try {
await remove(favRef);
window.showToast("تمت الإزالة من المحفوظات", "error");
} catch(err) { console.error(err); }
} else {
if(itemFullData) {
userFavorites.add(itemIdStr);
try {
await set(favRef, {
id: itemFullData.id,
title: itemFullData.title,
category: itemFullData.category,
summary: itemFullData.summary,
details: itemFullData.details,
sourceInfo: itemFullData.sourceInfo
});
window.showToast("تم الحفظ في المحفوظات بنجاح", "success");
} catch(err) { console.error(err); }
}
}
const btns = document.querySelectorAll(`button[data-fav-btn-id="${itemIdStr}"]`);
btns.forEach(btn => {
if (userFavorites.has(itemIdStr)) {
btn.className = "absolute top-5 left-5 z-10 p-2 rounded-full bg-slate-50 dark:bg-slate-800 transition-colors fill-red-500 text-red-500";
} else {
btn.className = "absolute top-5 left-5 z-10 p-2 rounded-full bg-slate-50 dark:bg-slate-800 transition-colors text-slate-300 dark:text-slate-600 hover:text-red-400";
}
});
updateStatsUI();
}
function loadUserFavorites(uid) {
const favRef = ref(db, `users/${uid}/favorites`);
get(favRef).then((snapshot) => {
if (snapshot.exists()) {
const data = snapshot.val();
userFavorites = new Set(Object.keys(data));
} else {
userFavorites.clear();
}
if(isDataLoaded) renderResults(allData.slice(0, 30));
updateStatsUI();
}).catch(console.error);
}
async function handleGoogleLogin() {
const provider = new GoogleAuthProvider();
const loader = document.getElementById('googleLoader');
if(loader) loader.classList.remove('hidden');
try {
await signInWithPopup(auth, provider);
window.toggleAuthModal(false);
} catch (error) {
showAuthError(error.message);
} finally {
if(loader) loader.classList.add('hidden');
}
}
function toggleAuthMode(e) {
e.preventDefault();
isSignUpMode = !isSignUpMode;
const title = document.getElementById('authTitle');
const btnText = document.getElementById('btnText');
const nameField = document.getElementById('nameFieldContainer');
const toggleBtn = document.getElementById('toggleAuthMode');
if (isSignUpMode) {
title.innerText = "إنشاء حساب جديد";
btnText.innerText = "تسجيل";
nameField.classList.remove('hidden');
toggleBtn.innerText = "لديك حساب بالفعل؟ تسجيل الدخول";
} else {
title.innerText = "تسجيل الدخول";
btnText.innerText = "دخول";
nameField.classList.add('hidden');
toggleBtn.innerText = "ليس لديك حساب؟ إنشاء حساب جديد";
}
}
async function handleEmailAuth(e) {
e.preventDefault();
const email = document.getElementById('emailInput').value;
const password = document.getElementById('passwordInput').value;
const name = document.getElementById('nameInput').value;
const btnLoader = document.getElementById('btnLoader');
const errorMsg = document.getElementById('authErrorMsg');
btnLoader.classList.remove('hidden');
errorMsg.classList.add('hidden');
try {
if (isSignUpMode) {
const userCredential = await createUserWithEmailAndPassword(auth, email, password);
await updateProfile(userCredential.user, { displayName: name });
await set(ref(db, 'users/' + userCredential.user.uid + '/profile'), {
displayName: name,
email: email
});
} else {
await signInWithEmailAndPassword(auth, email, password);
}
window.toggleAuthModal(false);
} catch (error) {
let msg = "حدث خطأ ما";
if(error.code === 'auth/wrong-password') msg = "كلمة المرور غير صحيحة";
else if(error.code === 'auth/user-not-found') msg = "البريد غير مسجل";
else if(error.code === 'auth/email-already-in-use') msg = "البريد مسجل مسبقاً";
else if(error.code === 'auth/weak-password') msg = "كلمة المرور ضعيفة";
showAuthError(msg);
} finally {
btnLoader.classList.add('hidden');
}
}
function showAuthError(msg) {
const el = document.getElementById('authErrorMsg');
el.innerText = msg;
el.classList.remove('hidden');
}
async function handleImageUpload(e) {
const file = e.target.files[0];
if (!file || !currentUser) return;
try {
const compressedBase64 = await compressImage(file);
document.getElementById('userAvatar').src = compressedBase64;
await set(ref(db, `users/${currentUser.uid}/profile/photoBase64`), compressedBase64);
window.showToast("تم تحديث الصورة الشخصية", "success");
} catch (err) {
window.showToast("فشل رفع الصورة", "error");
}
}
function compressImage(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.readAsDataURL(file);
reader.onload = (event) => {
const img = new Image();
img.src = event.target.result;
img.onload = () => {
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const MAX_WIDTH = 150;
const MAX_HEIGHT = 150;
let width = img.width;
let height = img.height;
if (width > height) {
if (width > MAX_WIDTH) {
height *= MAX_WIDTH / width;
width = MAX_WIDTH;
}
} else {
if (height > MAX_HEIGHT) {
width *= MAX_HEIGHT / height;
height = MAX_HEIGHT;
}
}
canvas.width = width;
canvas.height = height;
ctx.drawImage(img, 0, 0, width, height);
resolve(canvas.toDataURL('image/jpeg', 0.7));
};
img.onerror = (err) => reject(err);
};
reader.onerror = (err) => reject(err);
});
}
function loadUserProfileImage(uid) {
get(child(ref(db), `users/${uid}/profile/photoBase64`)).then((snapshot) => {
if (snapshot.exists()) {
document.getElementById('userAvatar').src = snapshot.val();
} else if (currentUser.photoURL) {
document.getElementById('userAvatar').src = currentUser.photoURL;
}
});
}
function updateStatsUI() {
const count = userFavorites.size;
const el = document.getElementById('favCount');
if(el) el.innerText = count;
}
function generateCategories() {
const container = document.getElementById('categoriesContainer');
const catLoading = document.getElementById('catLoading');
if(catLoading) catLoading.remove();
container.innerHTML = '';
const allBtn = document.createElement('button');
allBtn.innerText = "الكل";
allBtn.addEventListener('click', () => window.filterCategory('الكل'));
allBtn.className = "flex-shrink-0 px-5 py-2 rounded-full bg-slate-800 text-white text-sm font-medium shadow-md transition-transform active:scale-95 border border-transparent whitespace-nowrap";
container.appendChild(allBtn);
let uniqueCategories = [...new Set(allData.map(item => item.category))].filter(Boolean);
if (Array.isArray(booksOrder) && booksOrder.length) {
  const existing = new Set(uniqueCategories);
  uniqueCategories = booksOrder.filter(n => existing.has(n));
  uniqueCategories.push(...[...existing].filter(n => !booksOrder.includes(n)));
} else {
  uniqueCategories.sort();
}
uniqueCategories.forEach(cat => {
const btn = document.createElement('button');
btn.className = "flex-shrink-0 px-5 py-2 rounded-full bg-white dark:bg-dark-card border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:border-primary-500 transition-all active:scale-95 whitespace-nowrap";
btn.innerText = cat;
btn.addEventListener('click', () => window.filterCategory(cat));
container.appendChild(btn);
});
}
function setupTheme() {
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;
if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
html.classList.add('dark');
}
if(themeToggle) {
themeToggle.addEventListener('click', () => {
html.classList.add('disable-transitions');
html.classList.toggle('dark');
localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
setTimeout(() => {
html.classList.remove('disable-transitions');
}, 50);
});
}
}
function normalizeArabic(text) {
if (!text) return "";
text = String(text);
text = text.replace(/[\u064B-\u065F\u0640]/g, "");
text = text.replace(/[أإآ]/g, "ا");
text = text.replace(/ة/g, "ه");
text = text.replace(/[ىئ]/g, "ي");
text = text.replace(/ؤ/g, "و");
text = text.replace(/ء/g, "");
text = text.replace(/ظ/g, "ض");
return text;
}

function normalizeDigits(input) {
  if (input == null) return "";
  const s = String(input);
  const ar = '٠١٢٣٤٥٦٧٨٩';
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  let out = '';
  for (const ch of s) {
    const i1 = ar.indexOf(ch);
    if (i1 !== -1) { out += String(i1); continue; }
    const i2 = fa.indexOf(ch);
    if (i2 !== -1) { out += String(i2); continue; }
    out += ch;
  }
  return out;
}

function performSearch(term) {
if (!isDataLoaded) return;
const resultsCount = document.getElementById('resultsCount');
const countValue = document.getElementById('countValue');

if (!term || term.trim() === '') {
window.filterCategory(currentCategory, false);
return;
}

const rawTerm = term.trim().toLowerCase();
const rawDigits = normalizeDigits(rawTerm);
const compact = rawDigits.replace(/\s+/g, '');
const digitsOnly = compact.replace(/[^\d]/g, '');
const isNumericQuery = digitsOnly.length > 0 && digitsOnly.length === compact.length && /^\d+$/.test(digitsOnly);

let filtered = [];

// بحث بالرقم فقط: نطابق رقم المسألة بشكل (متساوي)
if (isNumericQuery) {
const target = Number(digitsOnly);
filtered = allData.filter(item => {
const isCategoryMatch = (currentCategory === 'الكل' || item.category === currentCategory);
if (!isCategoryMatch) return false;
const itemNoRaw = (item.masalaNo ?? item.order ?? '');
const itemNo = Number(normalizeDigits(String(itemNoRaw)).replace(/[^\d]/g, ''));
return itemNo === target;
});

// إن لم توجد نتائج، نعمل سقوطاً بحثاً جزئياً داخل رقم المسألة
if (filtered.length === 0) {
filtered = allData.filter(item => {
const isCategoryMatch = (currentCategory === 'الكل' || item.category === currentCategory);
if (!isCategoryMatch) return false;
const itemNoStr = normalizeDigits(String(item.masalaNo ?? item.order ?? ''));
return itemNoStr.includes(digitsOnly);
});
}
} else {
// بحث نصي عام (العنوان/التفاصيل/المعرف/رقم المسألة)
const searchTerms = rawTerm
.split(/\s+/)
.map(w => normalizeArabic(normalizeDigits(w)))
.filter(w => w.length > 0);

filtered = allData.filter(item => {
const isCategoryMatch = (currentCategory === 'الكل' || item.category === currentCategory);
if (!isCategoryMatch) return false;
const normalizedTitle = normalizeArabic(item.title);
const normalizedDetails = normalizeArabic(item.details);
const itemId = String(item.id ?? '');
const itemNoStr = normalizeDigits(String(item.masalaNo ?? item.order ?? ''));

return searchTerms.every(word => {
return (
normalizedTitle.includes(word) ||
normalizedDetails.includes(word) ||
itemId.includes(word) ||
itemNoStr.includes(word)
);
});
});
}

renderResults(filtered.slice(0, 100), rawTerm);
if (countValue) countValue.innerText = filtered.length;
if (resultsCount) resultsCount.classList.remove('hidden');
}

window.logoutUser = () => {
signOut(auth).then(() => {
window.toggleProfileModal(false);
window.location.reload();
});
};
window.toggleAuthModal = (show) => {
const modal = document.getElementById('authModal');
if(show) {
modal.classList.remove('hidden');
setTimeout(() => modal.classList.remove('opacity-0'), 10);
} else {
modal.classList.add('opacity-0');
setTimeout(() => modal.classList.add('hidden'), 300);
}
};
window.toggleProfileModal = (show) => {
const modal = document.getElementById('profileModal');
const content = document.getElementById('profileContent');
if(show) {
modal.classList.remove('hidden');
setTimeout(() => {
modal.classList.remove('opacity-0');
content.classList.remove('translate-y-full');
}, 10);
if(currentUser && currentUser.metadata.creationTime) {
const days = Math.floor((new Date() - new Date(currentUser.metadata.creationTime)) / (1000 * 60 * 60 * 24));
document.getElementById('daysSinceJoin').innerText = days || 1;
}
} else {
modal.classList.add('opacity-0');
content.classList.add('translate-y-full');
setTimeout(() => modal.classList.add('hidden'), 300);
}
};
window.filterCategory = function(category, clearSearch = true) {
currentCategory = category;
const buttons = document.querySelectorAll('#categoriesContainer button');
buttons.forEach(btn => {
if (btn.innerText === category) {
btn.className = "flex-shrink-0 px-5 py-2 rounded-full bg-slate-800 text-white text-sm font-medium shadow-md transition-transform active:scale-95 border border-transparent whitespace-nowrap";
} else {
btn.className = "flex-shrink-0 px-5 py-2 rounded-full bg-white dark:bg-dark-card border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:border-primary-500 transition-all active:scale-95 whitespace-nowrap";
}
});
if (clearSearch) {
const searchInput = document.getElementById('searchInput');
const resultsCount = document.getElementById('resultsCount');
if(searchInput) searchInput.value = '';
if(resultsCount) resultsCount.classList.add('hidden');
}
let filtered;
if (category === 'الكل') filtered = allData;
else filtered = allData.filter(item => item.category === category);
renderResults(filtered.slice(0, 50));
};
window.openModal = function(item) {
document.getElementById('modalTitle').textContent = item.title;
document.getElementById('modalCategoryBadge').textContent = item.category;
document.getElementById('modalPartInfo').textContent = item.sourceInfo;
const formatted = item.details.replace(/\n/g, '<br>');
document.getElementById('modalDetails').innerHTML = formatted;
const modalBackdrop = document.getElementById('modalBackdrop');
const modalSheet = document.getElementById('modalSheet');
modalBackdrop.classList.remove('hidden');
setTimeout(() => {
modalBackdrop.classList.remove('opacity-0');
modalSheet.classList.remove('translate-y-full');
}, 10);
document.body.classList.add('overflow-hidden');
};
window.closeModal = function() {
const modalBackdrop = document.getElementById('modalBackdrop');
const modalSheet = document.getElementById('modalSheet');
modalBackdrop.classList.add('opacity-0');
modalSheet.classList.add('translate-y-full');
setTimeout(() => {
modalBackdrop.classList.add('hidden');
document.body.classList.remove('overflow-hidden');
}, 300);
};
window.copyContent = async function(btnElement) {
let btn = btnElement;
if (!btn && window.event && window.event.currentTarget) {
btn = window.event.currentTarget;
}
if (!btn) btn = document.querySelector('button[onclick*="copyContent"]');
const titleElement = document.getElementById('modalTitle');
const textElement = document.getElementById('modalDetails');
if (!titleElement || !textElement) {
console.error("عناصر النص غير موجودة");
return;
}
const appSignature = "\n\n---\nتمت المشاركة بواسطة تطبيق منهج النور";
const fullText = `السؤال:\n${titleElement.innerText}\n\nالجواب:\n${textElement.innerText}${appSignature}`;
try {
if (navigator.clipboard && navigator.clipboard.writeText) {
await navigator.clipboard.writeText(fullText);
showSuccessEffect(btn);
} else {
throw new Error("Clipboard API unavailable");
}
} catch (err) {
try {
const textArea = document.createElement("textarea");
textArea.value = fullText;
textArea.style.top = "0";
textArea.style.left = "0";
textArea.style.position = "fixed";
textArea.style.opacity = "0";
document.body.appendChild(textArea);
textArea.focus();
textArea.select();
const successful = document.execCommand('copy');
document.body.removeChild(textArea);
if (successful) {
showSuccessEffect(btn);
window.showToast("تم نسخ النص للحافظة", "success");
} else {
alert("فشل النسخ تلقائياً.");
}
} catch (fallbackErr) {
console.error("فشل النسخ:", fallbackErr);
}
}
};
window.shareContent = function(btnElement) {
let btn = btnElement;
if (!btn && window.event && window.event.currentTarget) {
btn = window.event.currentTarget;
}
const titleElement = document.getElementById('modalTitle');
const textElement = document.getElementById('modalDetails');
if (!titleElement || !textElement) return;
const appSignature = "\n\n---\nتمت المشاركة بواسطة تطبيق منهج النور";
const fullText = `السؤال:\n${titleElement.innerText}\n\nالجواب:\n${textElement.innerText}${appSignature}`;
const shareData = {
title: titleElement.innerText,
text: fullText,
url: window.location.href,
};
if (navigator.share) {
navigator.share(shareData)
.then(() => console.log('تمت المشاركة بنجاح'))
.catch((error) => {
console.log('فشلت المشاركة، سيتم النسخ بدلاً من ذلك');
});
} else {
window.copyContent(btn);
}
};
function showSuccessEffect(btn) {
if (!btn) return;
const originalContent = btn.innerHTML;
btn.innerHTML = `
<div class="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
<span>تم</span>
</div>
`;
setTimeout(() => {
btn.innerHTML = originalContent;
if (window.lucide && window.lucide.createIcons) {
window.lucide.createIcons();
}
}, 2000);
}
async function openHistoryModal() {
if (!currentUser) {
window.toggleAuthModal(true);
return;
}
const backdrop = document.getElementById('historyBackdrop');
const sheet = document.getElementById('historySheet');
const listContainer = document.getElementById('notesListContainer');
backdrop.classList.remove('hidden');
setTimeout(() => {
backdrop.classList.remove('opacity-0');
sheet.classList.remove('translate-y-full');
}, 10);
document.body.classList.add('overflow-hidden');
listContainer.innerHTML = `
<div class="flex flex-col items-center justify-center h-full text-slate-400">
<div class="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mb-2"></div>
<p class="text-xs">جاري تحميل الملاحظات...</p>
</div>
`;
try {
const snapshot = await get(ref(db, `users/${currentUser.uid}/notes`));
if (snapshot.exists()) {
const notesObj = snapshot.val();
const notesList = Object.entries(notesObj).map(([key, value]) => ({
id: key,
...value
})).reverse();
renderNotesList(notesList, listContainer);
} else {
renderNotesList([], listContainer);
}
} catch (error) {
console.error(error);
listContainer.innerHTML = `<p class="text-red-500 text-center text-sm mt-10">فشل تحميل الملاحظات</p>`;
}
}
async function addNote() {
const input = document.getElementById('noteInput');
const text = input.value.trim();
if (!text || !currentUser) return;
input.value = '';
try {
const notesRef = ref(db, `users/${currentUser.uid}/notes`);
await push(notesRef, {
text: text,
date: new Date().toISOString()
});
const snapshot = await get(ref(db, `users/${currentUser.uid}/notes`));
if (snapshot.exists()) {
const notesList = Object.entries(snapshot.val()).map(([key, value]) => ({
id: key,
...value
})).reverse();
renderNotesList(notesList, document.getElementById('notesListContainer'));
}
} catch (err) {
alert("حدث خطأ أثناء الحفظ: " + err.message);
input.value = text;
}
}
async function deleteNote(noteId) {
if(!confirm("هل أنت متأكد من حذف هذه الملاحظة؟")) return;
try {
await remove(ref(db, `users/${currentUser.uid}/notes/${noteId}`));
const el = document.getElementById(`note-${noteId}`);
if(el) el.remove();
const container = document.getElementById('notesListContainer');
if(container.children.length === 0) renderNotesList([], container);
} catch(err) {
console.error(err);
}
}
function renderNotesList(notes, container) {
container.innerHTML = '';
if (notes.length === 0) {
container.innerHTML = `
<div class="flex flex-col items-center justify-center h-full text-slate-400 opacity-60 mt-10">
<i data-lucide="clipboard-list" class="w-12 h-12 mb-2"></i>
<p class="text-sm">لا توجد ملاحظات مدونة</p>
</div>
`;
} else {
notes.forEach(note => {
const date = new Date(note.date).toLocaleDateString('ar-EG');
const div = document.createElement('div');
div.id = `note-${note.id}`;
div.className = 'bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm relative group animate-slide-up';
div.innerHTML = `
<p class="text-slate-700 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap ml-6">${note.text}</p>
<div class="flex justify-between items-center mt-3 pt-3 border-t border-gray-50 dark:border-slate-700/50">
<span class="text-[10px] text-slate-400">${date}</span>
<button onclick="deleteNote('${note.id}')" class="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors absolute top-2 left-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
<i data-lucide="trash-2" class="w-4 h-4"></i>
</button>
</div>
`;
container.appendChild(div);
});
}
if(window.lucide) window.lucide.createIcons();
}
window.closeHistoryModal = function() {
const backdrop = document.getElementById('historyBackdrop');
const sheet = document.getElementById('historySheet');
backdrop.classList.add('opacity-0');
sheet.classList.add('translate-y-full');
setTimeout(() => {
backdrop.classList.add('hidden');
document.body.classList.remove('overflow-hidden');
}, 300);
};
window.addNote = addNote;
window.deleteNote = deleteNote;
window.openHistoryModal = openHistoryModal;
window.closeHistoryModal = closeHistoryModal;
window.showToast = function(message, type = 'success') {
const container = document.getElementById('toastContainer');
const toast = document.createElement('div');
toast.className = `pointer-events-auto flex items-center gap-3 p-4 rounded-xl shadow-lg border transform transition-all duration-300 translate-y-[-20px] opacity-0 ${
type === 'success'
? 'bg-white dark:bg-slate-800 border-green-500 text-slate-800 dark:text-white'
: type === 'error'
? 'bg-white dark:bg-slate-800 border-red-500 text-slate-800 dark:text-white'
: 'bg-white dark:bg-slate-800 border-blue-500 text-slate-800 dark:text-white'
}`;
let icon = '';
let iconColor = '';
if (type === 'success') {
icon = 'check-circle';
iconColor = 'text-green-500';
} else if (type === 'error') {
icon = 'alert-circle';
iconColor = 'text-red-500';
} else {
icon = 'info';
iconColor = 'text-blue-500';
}
toast.innerHTML = `
<div class="flex-shrink-0 ${iconColor}">
<i data-lucide="${icon}" class="w-6 h-6"></i>
</div>
<p class="text-sm font-medium">${message}</p>
`;
container.appendChild(toast);
if(window.lucide) window.lucide.createIcons();
requestAnimationFrame(() => {
toast.classList.remove('translate-y-[-20px]', 'opacity-0');
});
setTimeout(() => {
toast.classList.add('opacity-0', 'translate-y-[-20px]');
setTimeout(() => toast.remove(), 300);
}, 3000);
};
function highlightText(text, searchTerm) {
if (!searchTerm || searchTerm.trim().length < 2) return text;
const terms = searchTerm.trim().split(/\s+/).filter(w => w.length > 0);
let patternParts = [];
terms.forEach(term => {
let cleanTerm = normalizeArabic(term);
let charPattern = "";
for (let char of cleanTerm) {
let p = char;
if (['ا', 'أ', 'إ', 'آ'].includes(char)) p = '[اأإآ]';
else if (['ه', 'ة'].includes(char)) p = '[هة]';
else if (['ي', 'ى', 'ئ'].includes(char)) p = '[يىئ]';
else if (['و', 'ؤ'].includes(char)) p = '[وؤ]';
else if (['ض', 'ظ'].includes(char)) p = '[ضظ]';
charPattern += p + '[\\u064B-\\u065F\\u0640]*';
}
patternParts.push(charPattern);
});
if (patternParts.length === 0) return text;
try {
const regex = new RegExp(`(${patternParts.join('|')})`, 'gi');
return text.replace(regex, '<span class="bg-sky-200 dark:bg-sky-800 dark:text-white rounded px-1 mx-0.5">$1</span>');
} catch (e) {
return text;
}
}