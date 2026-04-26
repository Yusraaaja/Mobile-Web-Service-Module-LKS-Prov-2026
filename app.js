// 1. CONFIG & STATE
const API_URL = "https://api-mobile-service.lksn.id/api/v1";
const $ = id => document.getElementById(id);

let state = {
    page: 'home',
    theme: localStorage.getItem('theme') || 'system',
    bookmarks: JSON.parse(localStorage.getItem('bm')) || [],
    prefs: JSON.parse(localStorage.getItem('prefs')) || [],
    ds: { data: [], page: 1, q: '', cat: '', loading: false } // ds = discover state
};

// 2. OFFLINE TRAP & API WRAPPER
window.addEventListener('offline', () => location.href = 'game.html');
const api = async (endpoint) => {
    try { return await (await fetch(API_URL + endpoint)).json(); } 
    catch (err) {
        console.warn("API Offline, menggunakan data lokal untuk testing.");
    
        // 1. Dummy untuk Kategori (digunakan di halaman Discover/Settings)
        if (endpoint.includes("categories")) {
            return { 
                data: [
                    { id: 1, name: "Nasional" }, 
                    { id: 2, name: "Internasional" },
                    { id: 3, name: "Teknologi" },
                    { id: 4, name: "Hiburan" }
                ] 
            };
        }
    
        // 2. Dummy untuk Posts/Berita (digunakan di Home, Discover, Detail, dan Bookmark)
        if (endpoint.includes("posts")) {
            const dummyPosts = [
                { 
                    id: 1, 
                    title: "LKS Nasional 2026: Persiapan Modul Mobile Web Service", 
                    category: "Nasional",
                    views: 1240,
                    author: "Admin LKS",
                    date: "2026-04-11",
                    cover_image: "https://via.placeholder.com/400x200?text=LKS+Nasional+2026", 
                    content: "Ini adalah konten berita simulasi. Pastikan properti seperti tags dan author terisi agar renderDetail tidak error saat mencoba membaca properti tersebut.",
                    tags: ["LKS", "Web", "Nasional", "Simulasi"], // Wajib ada karena ada fungsi .join() di app.js
                    breaking: true
                },
                { 
                    id: 2, 
                    title: "Teknologi PWA Semakin Diminati Industri", 
                    category: "Teknologi",
                    views: 850,
                    author: "Tech Insider",
                    date: "2026-04-10",
                    cover_image: "https://via.placeholder.com/400x200?text=PWA+Technology",
                    content: "Progressive Web App memberikan pengalaman layaknya aplikasi native namun tetap ringan dijalankan di browser mobile.",
                    tags: ["PWA", "ServiceWorker", "Web"],
                    breaking: false
                }
            ];

            // Jika request spesifik per ID (misal: /posts/1)
            const match = endpoint.match(/\/posts\/(\d+)/);
            if (match) {
                const post = dummyPosts.find(p => p.id == match[1]) || dummyPosts[0];
                return { data: post };
            }

            return { data: dummyPosts };
        }

        return { data: [] }; // Fallback terakhir
    }
};

// 3. THEME MANAGER
const applyTheme = () => document.body.className = state.theme;
window.setTheme = (t) => { state.theme = t; localStorage.setItem('theme', t); applyTheme(); };
applyTheme();

// 4. ROUTER & RENDERER
window.navigate = (page) => { state.page = page; render(); };

const renderCard = (post) => `
    <div class="card" onclick="viewDetail(${post.id})">
        <small>${post.category}</small>
        <h3>${post.title}</h3>
    </div>`;

const render = async () => {
    const app = $('app');
    app.innerHTML = '<p>Loading...</p>';

    if (state.page === 'home') {
        const [news, recs] = await Promise.all([
            api('/posts?breaking=true'),
            api(`/posts?categories=${state.prefs.join(',')}`)
        ]);
        app.innerHTML = `
            <h2>Breaking News</h2>
            <div class="h-scroll">${(news?.data || []).map(renderCard).join('')}</div>
            <br><h2>For You</h2>
            <div>${(recs?.data || []).map(renderCard).join('')}</div>`;
            
    } else if (state.page === 'discover') {
        app.innerHTML = `
            <input type="text" placeholder="Search..." oninput="searchDebounce(this.value)">
            <select onchange="filterCat(this.value)" id="cat-select"><option value="">All Categories</option></select>
            <div id="res"></div><p id="loader" style="display:none">Loading more...</p>`;
        
        const cats = await api('/categories');
        if(cats) $('cat-select').innerHTML += cats.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        state.ds = { data: [], page: 1, q: '', cat: '', loading: false };
        loadMoreDiscover();
        
    } else if (state.page === 'bookmark') {
        if (!state.bookmarks.length) return app.innerHTML = '<p>No bookmarks.</p>';
        const res = await Promise.all(state.bookmarks.map(id => api(`/posts/${id}`)));
        app.innerHTML = res.map(r => renderCard(r.data)).join('');
        
    } else if (state.page === 'settings') {
        app.innerHTML = `
            <h2>Theme</h2>
            <select onchange="setTheme(this.value)">
                <option value="system" ${state.theme=='system'?'selected':''}>System</option>
                <option value="light" ${state.theme=='light'?'selected':''}>Light</option>
                <option value="dark" ${state.theme=='dark'?'selected':''}>Dark</option>
            </select>`;
    }
};

// 5. DISCOVER (DEBOUNCE & INFINITE SCROLL)
let timer;
window.searchDebounce = (v) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.ds.q = v; resetDiscover(); }, 800);
};
window.filterCat = (c) => { state.ds.cat = c; resetDiscover(); };

const resetDiscover = () => {
    state.ds.page = 1; state.ds.data = []; $('res').innerHTML = ''; loadMoreDiscover();
};

const loadMoreDiscover = async () => {
    if (state.ds.loading) return;
    state.ds.loading = true;
    if ($('loader')) $('loader').style.display = 'block';

    const res = await api(`/posts?page=${state.ds.page}&search=${state.ds.q}&category=${state.ds.cat}`);
    if (res?.data?.length) {
        state.ds.data.push(...res.data);
        $('res').innerHTML = state.ds.data.map(renderCard).join('');
        state.ds.page++;
    }
    
    state.ds.loading = false;
    if ($('loader')) $('loader').style.display = 'none';
};

$('app').addEventListener('scroll', () => {
    if (state.page === 'discover' && $('app').scrollHeight - $('app').scrollTop <= $('app').clientHeight + 50) {
        loadMoreDiscover();
    }
});

// 6. DETAIL & BOOKMARK LOGIC
window.viewDetail = async (id) => {
    const app = $('app');
    app.innerHTML = '<p>Loading...</p>';
    const res = await api(`/posts/${id}`);
    if (!res) return;
    const p = res.data;
    
    const isBm = state.bookmarks.includes(p.id);
    app.innerHTML = `
        <button class="btn" onclick="navigate('home')">Back</button>
        <button class="btn" onclick="toggleBm(${p.id})">${isBm ? 'Unbookmark' : 'Bookmark'}</button>
        <img src="${p.cover_image}" style="width:100%; border-radius:8px; margin:10px 0;">
        <small>${p.category} | 👁️ ${p.views} | ✍️ ${p.author}</small>
        <h2>${p.title}</h2>
        <p><small>${p.date}</small></p>
        <div style="margin:15px 0;">${p.content}</div>
        <p>Tags: ${p.tags.join(', ')}</p>
        <hr><br><h3>Related Articles</h3><div id="related"></div>
    `;
    
    const related = await api(`/posts?category=${p.category}&limit=3`);
    $('related').innerHTML = (related?.data || []).filter(r => r.id !== p.id).map(renderCard).join('');
};

window.toggleBm = (id) => {
    if (state.bookmarks.includes(id)) state.bookmarks = state.bookmarks.filter(b => b !== id);
    else state.bookmarks.push(id);
    localStorage.setItem('bm', JSON.stringify(state.bookmarks));
    viewDetail(id); // Re-render detail untuk update tombol
};

// INITIALIZE
navigate('home');