## SMSPortal iPhone Preview Demo

This is a small React/Vite demo that recreates the **SMS Portal** “Send Message” dashboard with an embedded **live iPhone preview**. As you type an SMS (or click the toolbar buttons for Template / Short URL / Landing Page / Opt‑out), the right‑hand iPhone updates in real time, including rich link previews for URLs that support unfurling (e.g. YouTube, news sites).

### Tech & structure
- **Stack**: React + Vite, single–page app (`src/App.jsx`, `src/main.jsx`, `src/index.css`).
- **Key pieces**:
  - SMS length / parts counter (GSM‑7 vs Unicode).
  - Link preview fetching via `noembed` with an `allorigins` + domain fallback.
  - Pixel‑aligned iOS dark‑mode iMessage shell that scrolls internally like a real device.

### Running locally
```bash
npm install
npm run dev
```

Open the printed URL in your browser and resize the window to see both the desktop dashboard and the responsive mobile layout. This repo is intended purely as a **product demo** for showcasing an SMSPortal feature idea, not as production code.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
