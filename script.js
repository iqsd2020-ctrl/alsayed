// --- استيراد مكتبات Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    child, 
    update, 
    remove 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- إعدادات Firebase ---
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

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- المتغيرات العامة ---
let allData = [];
let currentCategory = 'الكل';
let isDataLoaded = false;
let currentUser = null; // لتخزين بيانات المستخدم الحالي
let userFavorites = new Set(); // لتخزين معرفات المفضلة محلياً للسرعة

// --- عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    setupAuthListeners();
    setTimeout(initializeData, 100);
});

// ==========================================
// 1. منطق البيانات الأساسي (كما هو سابقاً مع تعديلات المفضلة)
// ==========================================

function initializeData() {
    const loadingState = document.getElementById('loadingState');
    const debugMsg = document.getElementById('debugMsg');

    if (typeof MasailData === 'undefined') {
        loadingState.innerHTML = '<p class="text-red-500">لم يتم العثور على ملف البيانات.</p>';
        return;
    }

    try {
        let rawEntries = [];
        if (Array.isArray(MasailData)) rawEntries = MasailData;
        else {
            // منطق البحث الذكي عن المصفوفة
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

        allData = rawEntries.map((item, index) => {
            let questionText = "مسألة بدون عنوان";
            let answerText = "";
            
            if (item.qa && Array.isArray(item.qa) && item.qa.length > 0) {
                questionText = item.qa[0].q || questionText;
                answerText = item.qa[0].a || "";
            } else if (item.q && item.a) {
                questionText = item.q;
                answerText = item.a;
            }

            return {
                id: item.id || `q_${index}`, // ضمان وجود ID
                title: questionText,
                category: item.volume_name || "عام",
                summary: answerText.substring(0, 85).replace(/\r\n|\n/g, ' ') + "...",
                details: answerText,
                sourceInfo: `الجزء: ${item.part || '-'} | ${item.volume_name || '-'}`
            };
        });

        isDataLoaded = true;
        loadingState.classList.add('hidden');
        generateCategories();
        
        // عرض النتائج بعد التأكد من تحميل المفضلة (إذا كان المستخدم مسجلاً)
        renderResults(allData.slice(0, 30));

    } catch (err) {
        loadingState.innerHTML = `<p class="text-red-500">خطأ: ${err.message}</p>`;
        console.error(err);
    }
}

function renderResults(data) {
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

    data.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all group animate-slide-up relative';
        if(index < 10) div.style.animationDelay = `${index * 0.03}s`;
        
        // التحقق مما إذا كانت المسألة في المفضلة
        const isFav = userFavorites.has(String(item.id));
        const heartClass = isFav ? 'fill-red-500 text-red-500' : 'text-slate-300 dark:text-slate-600 hover:text-red-400';

        // زر المفضلة (يضاف فوق الكارد)
        const favBtn = document.createElement('button');
        favBtn.className = `absolute top-5 left-5 z-10 p-2 rounded-full bg-slate-50 dark:bg-slate-800 transition-colors ${heartClass}`;
        favBtn.innerHTML = `<i data-lucide="heart" class="w-5 h-5 transition-colors"></i>`;
        favBtn.onclick = (e) => {
            e.stopPropagation(); // منع فتح المودال عند الضغط على القلب
            toggleFavorite(item.id);
        };

        // محتوى الكارد
        const contentDiv = document.createElement('div');
        contentDiv.className = 'cursor-pointer';
        contentDiv.onclick = () => openModal(item);
        
        let iconName = 'book';
        const cat = item.category;
        if(cat.includes('صلاة') || cat.includes('صوم')) iconName = 'sun';
        else if(cat.includes('زكاة') || cat.includes('خمس')) iconName = 'coins';

        contentDiv.innerHTML = `
            <div class="flex items-start justify-between mb-3 pr-8"> <div class="p-2 rounded-lg bg-gray-50 dark:bg-slate-700 text-primary-600 dark:text-primary-400">
                    <i data-lucide="${iconName}" class="w-5 h-5"></i>
                </div>
                <span class="text-[10px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md truncate max-w-[150px]">
                    ${item.category}
                </span>
            </div>
            <h3 class="font-headings font-bold text-lg text-slate-800 dark:text-slate-100 mb-2 leading-tight">
                ${item.title}
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed overflow-hidden h-10">
                ${item.summary}
            </p>
        `;

        div.appendChild(favBtn);
        div.appendChild(contentDiv);
        fragment.appendChild(div);
    });
    
    container.appendChild(fragment);
    if(window.lucide) window.lucide.createIcons();
}

// ==========================================
// 2. إدارة المستخدم و Firebase Auth
// ==========================================

function setupAuthListeners() {
    // 1. مراقب حالة تسجيل الدخول
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        const userBtn = document.getElementById('userBtn');
        const userAvatar = document.getElementById('userAvatar');
        
        if (user) {
            // المستخدم مسجل دخول
            console.log("Logged in:", user.email);
            
            // تحميل المفضلة من قاعدة البيانات
            loadUserFavorites(user.uid);
            
            // تحديث واجهة البروفايل
            document.getElementById('userNameDisplay').innerText = user.displayName || "مستخدم جديد";
            document.getElementById('userEmailDisplay').innerText = user.email;
            
            // جلب الصورة من قاعدة البيانات (لأنها نص طويل)
            loadUserProfileImage(user.uid);

            // زر الحساب يفتح البروفايل
            userBtn.onclick = () => toggleProfileModal(true);
            
        } else {
            // المستخدم غير مسجل
            console.log("Logged out");
            userFavorites.clear();
            renderResults(allData.slice(0, 30)); // إعادة رسم لإزالة القلوب الحمراء
            
            // إعادة ضبط الصورة الافتراضية
            if(userAvatar) userAvatar.src = `https://ui-avatars.com/api/?name=User&background=random`;

            // زر الحساب يفتح التسجيل
            userBtn.onclick = () => toggleAuthModal(true);
        }
    });

    // 2. إعداد أزرار المودال
    const googleBtn = document.getElementById('googleBtn');
    if(googleBtn) googleBtn.onclick = handleGoogleLogin;

    const emailForm = document.getElementById('emailForm');
    if(emailForm) emailForm.onsubmit = handleEmailAuth;

    const toggleModeBtn = document.getElementById('toggleAuthMode');
    if(toggleModeBtn) toggleModeBtn.onclick = toggleAuthMode;

    const profileUpload = document.getElementById('profileUpload');
    if(profileUpload) profileUpload.onchange = handleImageUpload;
}

// --- وظائف المصادقة ---

async function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();
    const loader = document.getElementById('googleLoader');
    loader.classList.remove('hidden');
    
    try {
        await signInWithPopup(auth, provider);
        toggleAuthModal(false);
    } catch (error) {
        showAuthError(error.message);
    } finally {
        loader.classList.add('hidden');
    }
}

let isSignUpMode = false;
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
            // تسجيل جديد
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // تحديث الاسم
            await updateProfile(userCredential.user, { displayName: name });
            // حفظ البيانات الأولية في DB
            await set(ref(db, 'users/' + userCredential.user.uid + '/profile'), {
                displayName: name,
                email: email
            });
        } else {
            // تسجيل دخول
            await signInWithEmailAndPassword(auth, email, password);
        }
        toggleAuthModal(false);
    } catch (error) {
        let msg = "حدث خطأ ما";
        if(error.code === 'auth/wrong-password') msg = "كلمة المرور غير صحيحة";
        else if(error.code === 'auth/user-not-found') msg = "البريد غير مسجل";
        else if(error.code === 'auth/email-already-in-use') msg = "البريد مسجل مسبقاً";
        else if(error.code === 'auth/weak-password') msg = "كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل)";
        
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

// ==========================================
// 3. قاعدة البيانات (Database Logic)
// ==========================================
async function toggleFavorite(itemId) {
    if (!currentUser) {
        toggleAuthModal(true);
        return;
    }

    // 1. البحث عن المسألة كاملة في البيانات المحلية
    // (نحتاج الكائن كاملاً لنرسله لقاعدة البيانات)
    const itemFullData = allData.find(i => String(i.id) === String(itemId));

    if (!itemFullData) {
        console.error("لم يتم العثور على بيانات المسألة");
        return;
    }

    const itemIdStr = String(itemId);
    const favRef = ref(db, `users/${currentUser.uid}/favorites/${itemIdStr}`);
    
    // فحص محلي سريع لتحديث الأيقونة فوراً (User Experience)
    const isFav = userFavorites.has(itemIdStr);
    if (isFav) {
        userFavorites.delete(itemIdStr); // حذف محلي
        // حذف من قاعدة البيانات
        try {
            await remove(favRef);
            // إذا كنا في صفحة المفضلة، أعد تحميلها لإخفاء العنصر المحذوف
            const favBtn = document.getElementById('favNavBtn');
            if (favBtn.classList.contains('text-primary-600')) {
                showFavorites(); 
            }
        } catch(err) { console.error(err); }
    } else {
        userFavorites.add(itemIdStr); // إضافة محلي
        // حفظ المسألة كاملة في قاعدة البيانات
        try {
            await set(favRef, {
                id: itemFullData.id,
                title: itemFullData.title,
                category: itemFullData.category,
                summary: itemFullData.summary,
                details: itemFullData.details,
                sourceInfo: itemFullData.sourceInfo
            });
        } catch(err) { console.error(err); }
    }
    
    // تحديث شكل القلوب في الصفحة الحالية
    renderResults(allData.filter(i => document.getElementById('resultsContainer').innerText.includes(i.title)));
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
        // تحديث الواجهة
        renderResults(allData.slice(0, 30)); // إعادة رسم لإظهار القلوب
        updateStatsUI();
    }).catch(console.error);
}

// --- الصور (ضغط + رفع Base64) ---
async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    // ضغط الصورة قبل الرفع
    try {
        const compressedBase64 = await compressImage(file);
        
        // عرض فوري
        document.getElementById('userAvatar').src = compressedBase64;

        // رفع لقاعدة البيانات
        await set(ref(db, `users/${currentUser.uid}/profile/photoBase64`), compressedBase64);
        console.log("Image saved successfully");
    } catch (err) {
        alert("فشل رفع الصورة: " + err.message);
    }
}

// دالة سحرية لضغط الصورة باستخدام Canvas
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
                
                // تحديد أبعاد قصوى صغيرة (أيقونة)
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

                // التحويل لنص Base64 بجودة متوسطة
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

// --- أدوات مساعدة ---
function updateStatsUI() {
    const count = userFavorites.size;
    const el = document.getElementById('favCount');
    if(el) el.innerText = count;
}

// جعل الوظائف متاحة عالمياً (لأننا في Module)
window.logoutUser = () => {
    signOut(auth).then(() => {
        toggleProfileModal(false);
        window.location.reload(); // تحديث الصفحة لتنظيف الذاكرة
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
        // تحديث التاريخ
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

// ==========================================
// 4. باقي وظائف الواجهة (بحث، تصنيف، ثيم)
// ==========================================

// هذه الدوال نسخت من كودك الأصلي لكن تحتاج لتكون Global
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

// --- إعدادات البحث والثيم ---
function generateCategories() {
    const container = document.getElementById('categoriesContainer');
    const catLoading = document.getElementById('catLoading');
    if(catLoading) catLoading.remove();
    container.innerHTML = ''; // تنظيف

    const allBtn = document.createElement('button');
    allBtn.innerText = "الكل";
    allBtn.onclick = () => window.filterCategory('الكل');
    // تنسيق زر الكل الافتراضي
    allBtn.className = "flex-shrink-0 px-5 py-2 rounded-full bg-slate-800 text-white text-sm font-medium shadow-md transition-transform active:scale-95 border border-transparent whitespace-nowrap";
    container.appendChild(allBtn);

    const uniqueCategories = [...new Set(allData.map(item => item.category))].filter(Boolean);
    uniqueCategories.sort();

    uniqueCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = "flex-shrink-0 px-5 py-2 rounded-full bg-white dark:bg-dark-card border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:border-primary-500 transition-all active:scale-95 whitespace-nowrap";
        btn.innerText = cat;
        btn.onclick = () => window.filterCategory(cat);
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
            html.classList.toggle('dark');
            localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
        });
    }
}

// ربط البحث
const searchInput = document.getElementById('searchInput');
let searchTimeout;
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(e.target.value);
        }, 300);
    });
}

function performSearch(term) {
    if (!isDataLoaded) return;
    term = term.toLowerCase().trim();
    const resultsCount = document.getElementById('resultsCount');
    const countValue = document.getElementById('countValue');

    if (term === '') {
        window.filterCategory(currentCategory, false);
        return;
    }

    const filtered = allData.filter(item => 
        (currentCategory === 'الكل' || item.category === currentCategory) &&
        (item.title.toLowerCase().includes(term) || item.details.toLowerCase().includes(term) || item.id.toString().includes(term))
    );

    renderResults(filtered.slice(0, 100));
    
    if(countValue) countValue.innerText = filtered.length;
    if(resultsCount) resultsCount.classList.remove('hidden');
}

// دالة النسخ والمشاركة (لأنها في HTML)
window.copyContent = function() {
    const text = document.getElementById('modalDetails').innerText;
    navigator.clipboard.writeText(text).catch(console.error);
    const btn = event.currentTarget;
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> تم النسخ';
    if(window.lucide) window.lucide.createIcons();
    setTimeout(() => {
        btn.innerHTML = originalIcon;
        if(window.lucide) window.lucide.createIcons();
    }, 2000);
};

window.shareContent = function() {
    const title = document.getElementById('modalTitle').innerText;
    const text = document.getElementById('modalDetails').innerText;
    if (navigator.share) {
        navigator.share({
            title: title,
            text: text.substring(0, 500) + "...",
            url: window.location.href,
        }).catch(console.log);
    } else {
        window.copyContent();
    }
};

window.resetApp = function() {
    window.filterCategory('الكل');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ==========================================
// 5. منطق عرض المحفوظات والتنقل
// ==========================================
window.showFavorites = function() {
    // 1. التحقق من المستخدم
    if (!currentUser) {
        toggleAuthModal(true);
        return;
    }

    // 2. تحديث واجهة الأزرار السفلية
    updateNavUI('fav');

    // 3. تجهيز الصفحة (إظهار حالة التحميل)
    const container = document.getElementById('resultsContainer');
    const searchInput = document.getElementById('searchInput');
    const resultsCount = document.getElementById('resultsCount');
    
    // تنظيف البحث والتصنيفات
    if(searchInput) searchInput.value = '';
    if(resultsCount) resultsCount.classList.add('hidden');
    document.querySelectorAll('#categoriesContainer button').forEach(btn => {
        btn.className = "flex-shrink-0 px-5 py-2 rounded-full bg-white dark:bg-dark-card border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:border-primary-500 transition-all active:scale-95 whitespace-nowrap";
    });

    // عرض سبينر التحميل
    container.innerHTML = `
        <div class="col-span-full text-center py-20">
            <div class="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p class="text-slate-500">جاري جلب محفوظاتك من السحابة...</p>
        </div>
    `;

    // 4. جلب البيانات من Firebase Realtime Database
    const favRef = ref(db, `users/${currentUser.uid}/favorites`);
    
    get(favRef).then((snapshot) => {
        if (snapshot.exists()) {
            const dataObj = snapshot.val();
            // تحويل الكائن إلى مصفوفة (Array)
            const favList = Object.values(dataObj);
            
            // تحديث القائمة المحلية للمعرفات (لضمان تزامن القلوب)
            userFavorites = new Set(Object.keys(dataObj));
            
            // عرض النتائج
            renderResults(favList);
        } else {
            // لا توجد محفوظات
            userFavorites.clear();
            container.innerHTML = `
                <div class="col-span-full text-center py-10 opacity-70 animate-slide-up">
                    <div class="w-16 h-16 bg-red-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                        <i data-lucide="heart-off" class="w-8 h-8"></i>
                    </div>
                    <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-2">محفظتك فارغة</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400">لم تقم بحفظ أي مسائل في السحابة بعد.</p>
                    <button onclick="resetApp()" class="mt-6 px-6 py-2 bg-primary-600 text-white rounded-full text-sm hover:bg-primary-700 transition-colors">
                        تصفح المسائل
                    </button>
                </div>
            `;
            if(window.lucide) window.lucide.createIcons();
        }
    }).catch((error) => {
        console.error(error);
        container.innerHTML = `<p class="text-red-500 text-center col-span-full">حدث خطأ أثناء جلب البيانات.</p>`;
    });
};

// تحديث دالة resetApp القديمة لتعيد تلوين زر الرئيسية
const originalResetApp = window.resetApp; // حفظ الدالة القديمة إذا أردت
window.resetApp = function() {
    // استدعاء المنطق القديم (تصفية الكل والعودة للأعلى)
    window.filterCategory('الكل');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // تحديث شكل الأزرار (تنشيط زر الرئيسية)
    updateNavUI('home');
};

// دالة مساعدة لتبديل ألوان الأزرار
function updateNavUI(activeTab) {
    const homeBtn = document.getElementById('homeNavBtn');
    const favBtn = document.getElementById('favNavBtn');
    
    // الكلاسات
    const activeClass = "text-primary-600 dark:text-primary-400";
    const inactiveClass = "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200";

    if (activeTab === 'fav') {
        // تلوين المحفوظات
        favBtn.className = favBtn.className.replace(inactiveClass, activeClass).replace('font-medium', 'font-bold');
        // إلغاء تلوين الرئيسية
        homeBtn.className = homeBtn.className.replace(activeClass, inactiveClass).replace('font-bold', 'font-medium');
        
        // تغيير أيقونة القلب لمليئة (اختياري جمالي)
        favBtn.querySelector('i').setAttribute('fill', 'currentColor');
    } else {
        // العكس: تلوين الرئيسية
        if (!homeBtn.className.includes(activeClass)) {
            homeBtn.className = homeBtn.className.replace(inactiveClass, activeClass).replace('font-medium', 'font-bold');
        }
        favBtn.className = favBtn.className.replace(activeClass, inactiveClass).replace('font-bold', 'font-medium');
        
        // إزالة ملء الأيقونة
        favBtn.querySelector('i').setAttribute('fill', 'none');
    }
    
    // إعادة رسم الأيقونات لتطبيق التغييرات
    if(window.lucide) window.lucide.createIcons();
}
