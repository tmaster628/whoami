import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import Hobbies from "./pages/Hobbies.tsx";
import SoundCapture from "./pages/sound-capture/page.tsx";
import Education from "./pages/Education.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/">
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/hobbies" element={<Hobbies />} />
        <Route path="/education" element={<Education />} />

        <Route path="/projects/sound-capture" element={<SoundCapture />} />
      </Routes>
    </BrowserRouter>{" "}
  </StrictMode>
);
