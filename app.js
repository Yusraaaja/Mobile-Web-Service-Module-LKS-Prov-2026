// 1. CONFIG & STATE
const API_URL = "https://api-mobile-service.lksn.id/api/v1";
const $ = id => document.getElementById(id);

let state = {
    page: 'home',
    theme: localStorage.getItem('theme') || 'system',
    bookmark: JSON.parse(localStorage.getItem('bm')) || [],
    prefs: JSON.parse(localStorage.getItem('prefs')) || [],
    ds: { data: [], page: 1, q: '', cat: '', loading: false } // ds = discover state
};

// 2. OFFLINE TRAP & API WRAPPER
window.addEventListener('offline', () => location.href = 'backup-game.html');
const api = async (endpoint) => {
    try { return await (await fetch(API_URL + endpoint)).json(); }
    catch (err) {
        console.warn("API Offline");

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
            const FakePost = [
                {
                    id: 1,
                    title: "Contoh 1",
                    category: "Nasional",
                    views: 1240,
                    author: "Admin",
                    date: "2026-04-11",
                    cover_image: "img1.jpg",
                    content: "Isi berita contoh 1",
                    tags: ["Nasional"],
                    breaking: true
                },
                {
                    id: 2,
                    title: "Contoh 2",
                    category: "Teknologi",
                    views: 850,
                    author: "Admin",
                    date: "2026-04-10",
                    cover_image: "img2.jpg",
                    content: "Isi berita contoh 2",
                    tags: ["Teknologi"],
                    breaking: false
                }
            ];
            // Jika request spesifik per ID (misal: /posts/1)
            const match = endpoint.match(/\/posts\/(\d+)/);
            if (match) {
                const post = FakePost.find(p => p.id == match[1]) || FakePost[0];
                return { data: post };
            }
            return { data: FakePost };
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
        if (cats) $('cat-select').innerHTML += cats.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        state.ds = { data: [], page: 1, q: '', cat: '', loading: false };
        loadMoreDiscover();

    } else if (state.page === 'bookmark') {
        if (!state.bookmark.length) return app.innerHTML = '<p>No bookmark.</p>';
        const res = await Promise.all(state.bookmark.map(id => api(`/posts/${id}`)));
        app.innerHTML = res.map(r => renderCard(r.data)).join('');

    } else if (state.page === 'settings') {
        let c = await api('/categories');
        let prefUI = (c?.data || []).map(x => `<label><input type="checkbox" onchange="togglePref('${x.name}')" ${state.prefs.includes(x.name) ? 'checked' : ''}> ${x.name}</label><br>`).join('');
        app.innerHTML = `
            <h2>Theme</h2>
            <select onchange="setTheme(this.value)">
                <option value="system" ${state.theme == 'system' ? 'selected' : ''}>System</option>
                <option value="light" ${state.theme == 'light' ? 'selected' : ''}>Light</option>
                <option value="dark" ${state.theme == 'dark' ? 'selected' : ''}>Dark</option>
            </select>
            <br><br><h2>Kategori Favorit</h2>${prefUI}`;
    }
};

window.togglePref = (c) => {
    state.prefs = state.prefs.includes(c) ? state.prefs.filter(x => x !== c) : [...state.prefs, c];
    localStorage.setItem('prefs', JSON.stringify(state.prefs));
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

    const isBm = state.bookmark.includes(p.id);
    app.innerHTML = `
        <button class="btn" onclick="navigate('home')">Back</button>
        <button class="btn" onclick="toggleBm(${p.id})">${isBm ? 'Unbookmark' : 'Bookmark'}</button>
        <img src="${p.cover_image}" style="width:100%; border-radius:8px; margin:10px 0;">
        <small>${p.category} | 👁️ ${p.views} | ✍️ ${p.author}</small>
        <h2>${p.title}</h2>
        <p><small>${p.date}</small></p>
        <div style="margin:15px 0;">${p.content}</div>
        <p>Tags: ${(p.tags || []).join(', ')}</p>
        <hr><br><h3>Related Articles</h3><div id="related"></div>
    `;

    const related = await api(`/posts?category=${p.category}&limit=3`);
    $('related').innerHTML = (related?.data || []).filter(r => r.id !== p.id).map(renderCard).join('');
};

window.toggleBm = (id) => {
    if (state.bookmark.includes(id)) state.bookmark = state.bookmark.filter(b => b !== id);
    else state.bookmark.push(id);
    localStorage.setItem('bm', JSON.stringify(state.bookmark));
    viewDetail(id); // Re-render detail untuk update tombol
};

// INITIALIZE
navigate('home');
