import { createRoot } from "react-dom/client";

import { App } from "./App";

import "./style.css";

function main() {
  const root = document.getElementById("root");

  if (root === null) {
    throw new Error("Root element #root not found");
  }

  createRoot(root).render(<App />);
}

main();
