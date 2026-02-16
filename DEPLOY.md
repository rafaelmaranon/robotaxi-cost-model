# Deployment Instructions

This project uses GitHub Pages deployment from the main branch `/docs` folder.

## Deployment Steps

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Add the built files to git**:
   ```bash
   git add docs
   ```

4. **Commit the changes**:
   ```bash
   git commit -m "build"
   ```

5. **Push to GitHub**:
   ```bash
   git push
   ```

6. **Configure GitHub Pages** (one-time setup):
   - Go to your repository on GitHub
   - Navigate to Settings → Pages
   - Under "Source", select "Deploy from a branch"
   - Choose "main" branch
   - Select "/docs" folder
   - Click "Save"

## Live Site

After deployment, your site will be available at:
https://rafaelmaranon.github.io/Waymo-cost-model/

## Notes

- The Vite config is set up with the correct base path: `/Waymo-cost-model/`
- Build output goes to `/docs` directory
- Assets are properly referenced with the base path
- No GitHub Actions workflow needed - deployment is direct from main:/docs
