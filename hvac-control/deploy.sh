#!/bin/bash

# Deployment script for HVAC control app

# Step 1: Restore source index.html if it was overwritten
cat > index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <title>Home Climate Control</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

echo "✓ Restored source index.html"

# Step 2: Build the app
npm run build

if [ $? -ne 0 ]; then
  echo "✗ Build failed"
  exit 1
fi

echo "✓ Build successful"

# Step 3: Copy built files to root
cp dist/index.html .
cp -r dist/assets .

echo "✓ Copied built files to root"
echo ""
echo "IMPORTANT: Built files contain environment variables and should NOT be committed to git."
echo "The assets/ folder is now in .gitignore to prevent accidental exposure."
echo ""
echo "To deploy, upload the following files to your web server:"
echo "  - index.html"
echo "  - assets/ (entire directory)"
echo ""
echo "Or use a deployment service like Netlify, Vercel, or GitHub Pages that builds from source."
