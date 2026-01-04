# Value Guess Trainer

A tiny static web app to train value perception:
- Shows a random color swatch
- You guess its grayscale value on a 1–10 scale
- Then it reveals the correct grayscale and tells you how far off you were (nearest bin)

## Deploy on GitHub Pages (simple)
1. Create a new repo and add these files:
   - `index.html`
   - `style.css`
   - `app.js`
2. In GitHub: Settings → Pages
3. Source: Deploy from a branch → `main` (or `master`) → `/root`
4. Save. Your site will appear at the Pages URL.

## Notes
- Value is computed as perceived luminance using linearized sRGB and Rec.709 coefficients.
- The “actual” shown is the nearest bin (1–10), not decimals.
- Stats are saved locally in your browser (localStorage). Reset with the button.
