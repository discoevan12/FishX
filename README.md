# 🐟 FishX — *Fresh Off the Catch*
> StockX, but for fish. Quick sells, live auctions, social flex.

**Team:** Evan Fahey · Biruh Abaneh · Robert Gareev · Maraki Mulualem

---

## 📁 File Structure

```
fishx2/
│
├── index.html        ← Landing page (public)
├── login.html        ← Google Sign-In
├── feed.html         ← Social catch feed (auth required)
├── market.html       ← Live marketplace (auth required)
├── sell.html         ← Upload + AI grade + list (auth required)
├── profile.html      ← User profile + stats (auth required)
│
├── assets/
│   └── logo.png      ← FishX logo
│
├── css/
│   ├── global.css    ← Shared tokens, components, nav, grid
│   ├── landing.css   ← Landing page styles
│   ├── login.css     ← Login page styles
│   ├── sell.css      ← Sell page styles
│   └── profile.css   ← Profile page styles
│
└── js/
    ├── shared.js     ← Firebase init, auth guard, utils
    ├── ai.js         ← Gemini API grading module
    └── sell.js       ← Sell page logic
```


## 🎨 Theme
- **Colors:** FishX Blue `#1877F2` + pure black `#0A0A0A`
- **Fonts:** Barlow Condensed (display) + DM Sans (body)
- **Logo:** Two marlins forming an X — used throughout all pages
