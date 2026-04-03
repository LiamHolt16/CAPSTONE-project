## What you need

- [Node.js](https://nodejs.org/)
- npm (comes with Node.js)

## Run the project (basic)

1. Open a terminal in the Splatter folder.
2. Install dependencies:

```bash
npm install
```

3. Build styles:

```bash
npx @tailwindcss/cli -i ./styles.css -o ./tailwind.css
```

4. Open `index.html` in your browser.

## Alternative: VS Code Live Server

If you prefer, you can run it with the Live Server extension instead of opening the file directly.

1. Install extension: **Live Server** (by Ritwick Dey).
2. In VS Code Explorer, right-click `index.html`.
3. Click **Open with Live Server**.
4. Keep using the same Tailwind build command when styles change:

```bash
npx @tailwindcss/cli -i ./styles.css -o ./tailwind.css
```

## If styles look wrong

Run:

```bash
npx @tailwindcss/cli -i ./styles.css -o ./tailwind.css
```

Then hard refresh:

- macOS: Cmd + Shift + R
- Windows: Ctrl + F5 (or Ctrl + Shift + R)

## Notes

- `tailwind.css` is generated automatically.
- `app.js` is intentionally empty right now.
- Exit code `130` usually means you stopped a command with Ctrl + C.
