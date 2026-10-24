// Punto di ingresso dell'interfaccia React.
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./stile.css";

ReactDOM.createRoot(document.getElementById("radice") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
