# DDLC AI — Hardware Lab Inventory & Purchase Ledger

An AI-driven hardware inventory management and purchase ledger application. Every added item is automatically numbered, calculated for total cost (with 0% GST), and recorded into the procurement ledger.

---

## 🚀 How to Host on GitHub (GitHub Pages)

This repository is pre-configured for automated **GitHub Pages** deployment with GitHub Actions and relative asset paths.

### Option 1: Automatic Deployment with GitHub Actions (Recommended)

1. **Create a GitHub repository** and push this project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of DDLC AI Inventory"
   git branch -M main
   git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub.
   - Click **Settings** (tab at the top).
   - In the left sidebar, click **Pages**.
   - Under **Build and deployment > Source**, select **GitHub Actions**.

3. **Done!**
   - The included workflow in `.github/workflows/deploy.yml` will automatically build and publish your site.
   - Your live URL will appear under the Pages section (e.g. `https://<YOUR-USERNAME>.github.io/<YOUR-REPO-NAME>/`).

---

### Option 2: Deploy Using the Pre-Built `dist` Folder

If you prefer deploying built files directly:

1. Build the production bundle:
   ```bash
   npm run build
   ```
2. The static site is generated in the `dist/` directory with relative asset paths (`./assets/...`).
3. You can deploy the `dist/` folder to GitHub Pages, Cloudflare Pages, Vercel, Netlify, or any static host.

---

## 🛠 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint
```

---

## ✨ Features

- **Automated Sequential Numbering**: Every item added is assigned an automatic ID (`#1`, `#2`, ... and `ITEM-001`, `ITEM-002`, ...).
- **Auto Purchase Ledger**: Every item addition is automatically marked as an item purchase with invoice tracking.
- **Pure Total Cost**: Calculated strictly as `Quantity × Unit Price` with zero GST or hidden taxes.
- **AI Command Center**: Natural language hardware intake (e.g., *"Add 5x ESP32 at ₹450"*, *"Delete item 2"*, *"Set stock to 20"*).
- **Standalone Client Mode**: Works in static hosting environments like GitHub Pages and retains local state seamlessly.
- **Cloud Firestore Real-time Sync**: Connects to Firebase Firestore for real-time multiplayer updates across devices.
