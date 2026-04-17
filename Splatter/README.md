## What you need

- [Node.js](https://nodejs.org/)
- npm

## Project overview

This project is a browser-based Three.js viewer with two switchable scenes:

- Littlest Tokyo loaded from the official Three.js example asset
- A local Gaussian splat scene loaded from `models/tape_measure.ksplat`

## Run the project

1. Open a terminal in the `Splatter` folder.
2. Install dependencies:

```bash
npm install
```

3. Build styles:

```bash
npx @tailwindcss/cli -i ./styles.css -o ./tailwind.css
```

4. Serve the folder from a local web server.

You should not open `index.html` directly from the filesystem because the app loads ES modules and fetches local assets.

## Quick local server options

### VS Code Live Server

1. Install **Live Server**.
2. Right-click `index.html`.
3. Select **Open with Live Server**.

### Python

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Notes

- `tailwind.css` is generated from `styles.css`.
- Scene 2 depends on `models/tape_measure.ksplat` being present.
- `app.js` contains the viewer, scene-switching, and Gaussian splat loading logic.
