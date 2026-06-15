import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted fonts so the site renders without Google Fonts, which is blocked in mainland China.
import "@fontsource-variable/dm-sans/opsz.css";
import "@fontsource-variable/dm-sans/opsz-italic.css";
import "@fontsource/libre-baskerville/400.css";
import "@fontsource/libre-baskerville/400-italic.css";
import "@fontsource/libre-baskerville/700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
