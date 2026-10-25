import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App kind={import.meta.env.DEV ? "all" : "admin"} />
  </React.StrictMode>,
);
