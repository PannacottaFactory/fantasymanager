import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
// Fonts are bundled (no Google Fonts request): the game works offline, as a desktop build will need.
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/spectral-sc/500.css';
import '@fontsource/spectral-sc/600.css';
import '@fontsource/spectral-sc/700.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
