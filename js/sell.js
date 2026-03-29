/* sell.js — Sell Page Logic (no AI grading) */

requireAuth(initSell);

let currentFiles = [];
let listingType  = "flat";

function initSell(user) {
  const uploadZone    = document.getElementById("uploadZone");
  const fileInput     = document.getElementById("fileInput");
  const uploadTrig    = document.getElementById("uploadTrigger");
  const previewStrip  = document.getElementById("previewStrip");
  const submitBtn     = document.getElementById("submitBtn");
  const durSelect     = document.getElementById("auctionDuration");
  const autoBuyout    = document.getElementById("autoBuyout");
  const buyoutInput   = document.getElementById("buyoutPrice");
  const startBidInput = document.getElementById("startBid");

  uploadTrig.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));
  uploadZone.addEventListener("dragover", e => { e.preventDefault(); uploadZone.classList.add("drag-over"); });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
  uploadZone.addEventListener("drop", e => { e.preventDefault(); uploadZone.classList.remove("drag-over"); handleFiles(e.dataTransfer.files); });

  const MAX_IMAGE_KB = 2000;

  function handleFiles(files) {
    if (!files.length) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!imageFiles.length) { toast("Please upload image files.", "error"); return; }

    // Enforce 2000 KB limit per image
    const oversized = imageFiles.filter(f => f.size > MAX_IMAGE_KB * 1024);
    if (oversized.length) {
      const names = oversized.map(f => `${f.name} (${(f.size/1024).toFixed(0)} KB)`).join(", ");
      toast(`Image${oversized.length > 1 ? "s" : ""} too large (max ${MAX_IMAGE_KB} KB): ${names}`, "error");
      return;
    }

    currentFiles = imageFiles;
    previewStrip.innerHTML = "";
    currentFiles.forEach(f => {
      const img = document.createElement("img");
      img.className = "preview-thumb";
      img.src = URL.createObjectURL(f);
      previewStrip.appendChild(img);
    });
    document.getElementById("uploadIdle").classList.add("hidden");
  }

  // ── Listing type toggle ──
  document.querySelectorAll(".type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      listingType = btn.dataset.type;
      document.getElementById("flatFields").classList.toggle("hidden", listingType !== "flat");
      document.getElementById("auctionFields").classList.toggle("hidden", listingType !== "auction");
    });
  });

  // ── Custom duration ──
  durSelect.addEventListener("change", () => {
    document.getElementById("customHoursGroup").classList.toggle("hidden", durSelect.value !== "custom");
  });

  // ── Auto buyout (defaults ON, 10x starting bid) ──
  function updateAutoBuyout() {
    if (autoBuyout.checked) {
      const sb = parseFloat(startBidInput.value);
      if (sb > 0) { buyoutInput.value = (sb * 10).toFixed(2); buyoutInput.disabled = true; }
    }
  }
  autoBuyout.checked = true;
  buyoutInput.disabled = true;
  autoBuyout.addEventListener("change", () => {
    if (autoBuyout.checked) { buyoutInput.disabled = true; updateAutoBuyout(); }
    else { buyoutInput.disabled = false; }
  });
  startBidInput.addEventListener("input", () => { if (autoBuyout.checked) updateAutoBuyout(); });

  // ── Upload image to Firebase Storage ──
  async function uploadFishImage(file, listingKey) {
    const storageRef = firebase.storage().ref(`listings/${listingKey}/${Date.now()}_${file.name}`);
    const progress = document.getElementById("uploadProgress");
    const bar = document.getElementById("uploadProgressBar");
    progress.classList.remove("hidden");
    return new Promise((resolve, reject) => {
      const task = storageRef.put(file);
      task.on("state_changed",
        snap => { bar.style.width = `${(snap.bytesTransferred/snap.totalBytes*100).toFixed(0)}%`; },
        err => { progress.classList.add("hidden"); reject(err); },
        async () => { const url = await task.snapshot.ref.getDownloadURL(); progress.classList.add("hidden"); resolve(url); }
      );
    });
  }

  // ── Submit ──
  submitBtn.addEventListener("click", async () => {
    const title   = document.getElementById("fishTitle").value.trim();
    const desc    = document.getElementById("fishDesc").value.trim();
    const species = document.getElementById("fishSpecies").value.trim();
    if (!title) { toast("Give your catch a title!", "error"); return; }
    submitBtn.disabled = true;
    submitBtn.textContent = "Listing…";

    try {
      const profSnap = await db.ref(`users/${user.uid}`).once("value");
      const profile  = profSnap.val() || {};

      const base = {
        title,
        description: desc,
        type: listingType,
        emoji:   "🐟",
        species: species || null,
        userName:     profile.username  || user.displayName || "Anon Fisher",
        userPhoto:    user.photoURL     || "",
        userLocation: profile.location  || null,
        userId:       user.uid,
        sellerId:     user.uid,
        sellerName:   profile.username  || user.displayName || "Anon Fisher",
        sold: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };

      if (listingType === "flat") {
        const p = parseFloat(document.getElementById("fishPrice").value);
        if (!p || p <= 0) { toast("Enter a valid price.", "error"); submitBtn.disabled=false; submitBtn.textContent="List on FishX"; return; }
        if (p > 1000) { toast("Price cannot exceed $1,000 to prevent spam.", "error"); submitBtn.disabled=false; submitBtn.textContent="List on FishX"; return; }
        base.price = p;
      } else {
        const sb = parseFloat(startBidInput.value);
        let hrs;
        if (durSelect.value === "custom") {
          hrs = parseInt(document.getElementById("customHours").value);
          if (!hrs || hrs < 1) { toast("Enter a valid custom duration.", "error"); submitBtn.disabled=false; submitBtn.textContent="List on FishX"; return; }
        } else {
          hrs = parseInt(durSelect.value) || 24;
        }
        if (!sb || sb <= 0) { toast("Enter a valid starting bid.", "error"); submitBtn.disabled=false; submitBtn.textContent="List on FishX"; return; }
        if (sb > 1000) { toast("Starting bid cannot exceed $1,000 to prevent spam.", "error"); submitBtn.disabled=false; submitBtn.textContent="List on FishX"; return; }
        base.startBid   = sb;
        base.currentBid = sb;
        base.endsAt     = Date.now() + hrs * 3600000;
        const bp = parseFloat(document.getElementById("buyoutPrice").value);
        base.buyoutPrice = (bp && bp > 0) ? bp : sb * 10;
      }

      const listRef = await db.ref("listings").push(base);
      const key = listRef.key;

      let imageUrl = null;
      if (currentFiles.length > 0) {
        try {
          imageUrl = await uploadFishImage(currentFiles[0], key);
          await db.ref(`listings/${key}`).update({ imageUrl });
        } catch(imgErr) {
          console.warn("Image upload failed:", imgErr);
        }
      }

      toast("Catch listed! Check the Market!", "success");
      setTimeout(() => window.location.href = `listing.html?key=${key}`, 1200);
    } catch (err) {
      console.error(err);
      toast("Failed to list: " + err.message, "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "List on FishX";
    }
  });
}
