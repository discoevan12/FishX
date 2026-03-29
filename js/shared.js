/* shared.js — Firebase init, Auth helpers, Toast, Nav utils */

const firebaseConfig = {
  apiKey:            "AIzaSyDj_VBPuJ3_BltI_DAeu3JnndFkn63ZSbI",
  authDomain:        "fishx-8723f.firebaseapp.com",
  databaseURL:       "https://fishx-8723f-default-rtdb.firebaseio.com",
  projectId:         "fishx-8723f",
  storageBucket:     "fishx-8723f.firebasestorage.app",
  messagingSenderId: "199963689051",
  appId:             "1:199963689051:web:0e44ef8adc3d386ff7ff7e"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth    = firebase.auth();
const db      = firebase.database();
const storage = firebase.storage();

const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

// ── Nav unread badge ─────────────────────────────────────────
function initNavMessageBadge(user) {
  const link = document.querySelector('a[href="messages.html"]');
  if (!link) return;
  db.ref("conversations").on("value", snap => {
    let unread = 0;
    snap.forEach(c => {
      const v = c.val();
      if (v && v.participants && v.participants[user.uid] === true &&
          v.lastSenderId && v.lastSenderId !== user.uid && !v[`readBy_${user.uid}`]) {
        unread++;
      }
    });
    // Update link text with badge
    if (unread > 0) {
      link.innerHTML = `Messages <span style="display:inline-flex;align-items:center;justify-content:center;background:var(--blue);color:#fff;font-size:0.65rem;font-weight:800;border-radius:50%;width:18px;height:18px;margin-left:4px;vertical-align:middle;">${unread}</span>`;
    } else {
      link.textContent = "Messages";
    }
  });
}

function requireAuth(callback) {
  auth.onAuthStateChanged(async user => {
    if (user) { updateNavUser(user); if (callback) callback(user); }
    else window.location.href = "login.html";
  });
}

function redirectIfAuthed(destination = "market.html") {
  auth.onAuthStateChanged(user => { if (user) window.location.href = destination; });
}

async function updateNavUser(user) {
  const avatar = document.getElementById("navAvatar");
  const uname  = document.getElementById("navUsername");
  try {
    const snap = await db.ref(`users/${user.uid}/username`).once("value");
    const username = snap.val();
    if (uname) uname.textContent = username || user.displayName?.split(" ")[0] || "Fisher";
  } catch(e) {
    if (uname) uname.textContent = user.displayName?.split(" ")[0] || "Fisher";
  }
  if (avatar && user.photoURL) { avatar.src = user.photoURL; avatar.style.display = "block"; }
  initNavMessageBadge(user);
}

function signOut() { auth.signOut().then(() => window.location.href = "index.html"); }

function toast(msg, type = "info", duration = 3500) {
  let container = document.getElementById("toastContainer");
  if (!container) { container = document.createElement("div"); container.id = "toastContainer"; document.body.appendChild(container); }
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.style.animation = "toastOut 0.3s ease forwards"; setTimeout(() => el.remove(), 320); }, duration);
}

async function upsertProfile(user) {
  const snap = await db.ref(`users/${user.uid}`).once("value");
  const existing = snap.val();
  const isNew = !existing || !existing.username;
  await db.ref(`users/${user.uid}`).update({
    uid: user.uid, displayName: user.displayName || "Anon Fisher",
    photoURL: user.photoURL || "", email: user.email || "",
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });
  return isNew;
}

function relTime(ts) {
  const d = Date.now() - ts;
  if (d < 60000)   return "just now";
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000)return `${Math.floor(d/3600000)}h ago`;
  return `${Math.floor(d/86400000)}d ago`;
}

function usd(v) { return `$${Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`; }

function gradeClass(g) { return { S:"grade-S", A:"grade-A", B:"grade-B", C:"grade-C" }[g] || "grade-C"; }

function buildFishCard(key, item, opts = {}) {
  const { showBuy = false, showBid = false, showLike = false } = opts;
  const user = auth.currentUser;
  const card = document.createElement("div");
  card.className = "fish-card";
  card.dataset.key = key;
  const isAuction = item.type === "auction";
  const price     = isAuction ? (item.currentBid || item.startBid || 0) : (item.price || 0);
  const likeCount = Object.keys(item.likes || {}).length;
  const liked     = item.likes?.[user?.uid] === true;
  const isEnded   = isAuction && item.endsAt && item.endsAt < Date.now();
  const hasBuyout = isAuction && item.buyoutPrice && item.buyoutPrice > 0;

  const imgHtml = item.imageUrl
    ? `<img src="${item.imageUrl}" alt="${item.title||''}" style="width:100%;height:100%;object-fit:cover;"/>`
    : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:3.5rem;">${item.emoji||"🐠"}</div>`;

  card.innerHTML = `
    <div class="fish-card-img fish-card-clickable" data-key="${key}" style="position:relative;cursor:pointer;">
      ${imgHtml}
      ${item.grade ? `<span class="grade ${gradeClass(item.grade)}" style="position:absolute;top:10px;right:10px;font-size:0.75rem;">${item.grade}</span>` : ""}
      <span style="position:absolute;top:10px;left:10px;font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:20px;${(item.sold||isEnded)?'background:rgba(239,68,68,0.92);color:#fff;':isAuction?'background:rgba(245,158,11,0.9);color:#000;':'background:rgba(34,197,94,0.9);color:#000;'}">${(item.sold||isEnded)?"SOLD":isAuction?"AUCTION":"BUY NOW"}</span>
    </div>
    <div class="fish-card-body">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <span class="fish-card-title fish-card-clickable" data-key="${key}" style="cursor:pointer;">${item.title||"Untitled Catch"}</span>
      </div>
      <div class="fish-card-meta">
        ${item.userPhoto?`<img class="fish-card-avatar" src="${item.userPhoto}" alt=""/>`: `<div style="width:20px;height:20px;border-radius:50%;background:var(--blue-dim);display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:var(--blue-light);">F</div>`}
        <a class="fish-card-user" href="profile.html?uid=${item.sellerId||item.userId||''}" onclick="event.stopPropagation()" style="text-decoration:none;color:inherit;cursor:pointer;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${item.userName||"Anon Fisher"}</a>
        ${item.userLocation?`<span style="font-size:0.7rem;color:var(--text-dim);margin-left:4px;">&#x1F4CD; ${item.userLocation}</span>`:""}
        <span style="margin-left:auto;font-size:0.72rem;color:var(--text-dim);">${relTime(item.createdAt||Date.now())}</span>
      </div>
      ${item.description?`<p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${item.description}</p>`:""}
      <div class="fish-card-footer">
        <div>
          <p class="price-label">${(item.sold||isEnded)?"Final Bid":isAuction?"Current Bid":"Price"}</p>
          <p class="price-tag">${usd(price)}</p>
          ${hasBuyout&&!item.sold&&!isEnded?`<p style="font-size:0.7rem;color:var(--gold);margin-top:2px;">Buyout: ${usd(item.buyoutPrice)}</p>`:""}
          ${isAuction&&item.endsAt&&!item.sold&&!isEnded?`<p style="font-size:0.7rem;color:var(--orange);margin-top:2px;">${countdown(item.endsAt)}</p>`:""}
          ${(item.sold||isEnded)?`<p style="font-size:0.7rem;color:var(--red);margin-top:2px;">Auction ended</p>`:""}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
          ${showLike?`<button class="btn btn-ghost btn-sm like-btn${liked?" liked":""}" data-key="${key}" style="${liked?"color:var(--red)":""}">&#10084; ${likeCount}</button>`:""}
          ${showBid&&isAuction&&!isEnded&&!item.sold?`<button class="btn btn-primary btn-sm bid-btn" data-key="${key}">Bid</button>`:""}
          ${showBid&&hasBuyout&&!isEnded&&!item.sold?`<button class="btn btn-outline btn-sm buyout-btn" data-key="${key}">Buyout</button>`:""}
          ${showBuy&&!isAuction&&!item.sold?`<button class="btn btn-primary btn-sm buy-btn" data-key="${key}">Buy Now</button>`:""}
        </div>
      </div>
    </div>`;

  card.querySelectorAll(".fish-card-clickable").forEach(el => {
    el.addEventListener("click", () => window.location.href = `listing.html?key=${key}`);
  });
  return card;
}

function countdown(endsAt) {
  const diff = endsAt - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h/24)}d ${h%24}h left`;
  return `${h}h ${m}m left`;
}

function showOnboardingModal(user, onComplete) {
  const overlay = document.createElement("div");
  overlay.id = "onboardingModal";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.9);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.3s;";
  overlay.innerHTML = `
    <div style="background:var(--gray-900);border:1px solid var(--border-blue);border-radius:var(--r-xl);padding:40px;width:100%;max-width:500px;box-shadow:var(--shadow-blue);animation:riseUp 0.4s var(--bounce);">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="font-size:2.5rem;margin-bottom:12px;">&#127919;</div>
        <h2 style="font-family:var(--font-display);font-size:2rem;font-weight:900;margin-bottom:8px;">WELCOME TO FISHX</h2>
        <p style="color:var(--text-muted);font-size:0.9rem;">Set up your fisher profile before you start</p>
      </div>
      <div class="form-group">
        <label class="form-label">Display Username *</label>
        <input class="form-input" id="ob_username" type="text" placeholder="e.g. CaptainHook42" maxlength="32"/>
        <p style="font-size:0.72rem;color:var(--text-dim);margin-top:5px;">Shown on all your listings and bids</p>
      </div>
      <div class="form-group">
        <label class="form-label">Location *</label>
        <input class="form-input" id="ob_location" type="text" placeholder="e.g. Miami, FL or Pacific Coast" maxlength="60"/>
        <p style="font-size:0.72rem;color:var(--text-dim);margin-top:5px;">City, state, or fishing region — visible on your listings</p>
      </div>
      <div class="form-group">
        <label class="form-label">Favorite Fishing Spot <span style="font-weight:400;color:var(--text-dim);">(optional)</span></label>
        <input class="form-input" id="ob_spot" type="text" placeholder="e.g. Gulf of Mexico, Lake Erie…" maxlength="80"/>
      </div>
      <div class="form-group">
        <label class="form-label">Years Fishing <span style="font-weight:400;color:var(--text-dim);">(optional)</span></label>
        <select class="form-input" id="ob_years">
          <option value="">Select…</option>
          <option>Under 1 year</option><option>1-3 years</option><option>3-5 years</option>
          <option>5-10 years</option><option>10+ years</option><option>20+ years</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block" id="ob_submit" style="margin-top:8px;font-size:1rem;padding:14px;">Get on the Dock</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById("ob_submit").addEventListener("click", async () => {
    const username = document.getElementById("ob_username").value.trim();
    const location = document.getElementById("ob_location").value.trim();
    if (!username) { toast("Please enter a username", "error"); return; }
    if (!location) { toast("Please enter your location", "error"); return; }
    const btn = document.getElementById("ob_submit");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      await db.ref(`users/${user.uid}`).update({
        username, location,
        favSpot: document.getElementById("ob_spot").value.trim() || null,
        yearsExperience: document.getElementById("ob_years").value || null,
        onboarded: true
      });
      overlay.remove();
      toast(`Welcome, ${username}!`, "success");
      if (onComplete) onComplete({ username, location });
    } catch(err) {
      toast("Failed to save: " + err.message, "error");
      btn.disabled = false; btn.textContent = "Get on the Dock";
    }
  });
}
