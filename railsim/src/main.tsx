import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import L from "leaflet";
import rotateUrl from "leaflet-rotate/dist/leaflet-rotate.js?url";
import "./index.css";

(window as unknown as { L: typeof L }).L = L;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("leaflet-rotate"));
    document.head.appendChild(script);
  });
}

void loadScript(rotateUrl).then(async () => {
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
