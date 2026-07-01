/* @refresh reload */
import { render } from "solid-js/web";

import { App } from "./App";

import "./style.css";

function main() {
  const root = document.getElementById("root");

  if (root === null) {
    throw new Error("Root element #root not found");
  }

  render(() => <App />, root);
}

main();
