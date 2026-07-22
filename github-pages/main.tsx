import React from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { MicsDashboard } from "../app/MicsDashboard";

createRoot(document.getElementById("root")!).render(<React.StrictMode><MicsDashboard /></React.StrictMode>);
