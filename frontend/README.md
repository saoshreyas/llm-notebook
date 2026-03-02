# LLM Notebook Frontend

Modern React frontend built with Vite, Tailwind CSS, and shadcn/ui components.

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Backend Connection

The frontend is configured to connect to the backend at `http://localhost:8000` via proxy.

If your backend runs on a different port, update `vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:YOUR_PORT',  // Change this
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Build for Production

```bash
npm run build
```

This creates optimized files in the `dist` folder.

Preview the production build:
```bash
npm run preview
```

## Features

### 🎨 Design System
- **Dark theme** with custom color palette
- **shadcn/ui components** - Button, Card, etc.
- **Tailwind CSS** for utility-first styling
- **Smooth animations** - floating, sliding, pulsing effects

### 🚀 Functionality
- **Multiple cells** - Add/delete notebook cells
- **Live execution** - Run cells with Shift+Enter
- **Real-time API status** - Shows backend connection
- **Error handling** - Clear error messages
- **Loading states** - Visual feedback during processing

### 🎯 Key Components

**App.jsx** - Main application with health check
**NotebookCell.jsx** - Individual notebook cell with I/O
**Button.jsx** - shadcn-style button component
**Card.jsx** - shadcn-style card component

## Architecture

```
Frontend (React) → API Proxy → Backend (FastAPI) → vLLM
```

The Vite dev server proxies `/api/*` requests to the backend automatically.

## Customization

### Change Colors

Edit `src/index.css` to modify the color scheme:

```css
:root {
  --primary: 174 100% 42%;      /* Teal */
  --secondary: 352 88% 71%;     /* Coral */
  --accent: 45 100% 70%;        /* Yellow */
  /* ... */
}
```

### Add More Components

Follow the shadcn/ui pattern:

1. Create component in `src/components/`
2. Use `cn()` utility for className merging
3. Export and use in your app

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS
- **Lucide React** - Icon library
- **shadcn/ui** - Component system (implemented manually)

## Troubleshooting

**Cannot connect to backend:**
- Make sure backend is running on port 8000
- Check the proxy configuration in `vite.config.js`

**Styling issues:**
- Run `npm run dev` again to rebuild Tailwind
- Check that `tailwind.config.js` is properly configured

**Build errors:**
- Clear cache: `rm -rf node_modules package-lock.json`
- Reinstall: `npm install`
