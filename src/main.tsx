import { createRoot } from "react-dom/client";
// Initialize Lovable auth globally so it can process OAuth callbacks
// on ANY page (not just Auth.tsx). Without this, returning from Google
// OAuth to "/" would fail because the callback handler isn't loaded.
import "./integrations/lovable/index";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
