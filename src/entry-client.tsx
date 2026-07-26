import "./styles.css";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

const router = getRouter();

const root = document.getElementById("root")!;
ReactDOM.createRoot(root).render(<RouterProvider router={router} />);
