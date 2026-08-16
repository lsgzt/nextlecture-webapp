import { COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";
import { trpc } from "./lib/trpc";

const queryClient = new QueryClient();
const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError) || typeof window === "undefined" || error.message !== UNAUTHED_ERR_MSG) return;
  startLogin();
};

queryClient.getQueryCache().subscribe(event => { if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.query.state.error); });
queryClient.getMutationCache().subscribe(event => { if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.mutation.state.error); });

const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, headers() { try { const raw = sessionStorage.getItem("manus-cookie"); const prefix = `${COOKIE_NAME}=`; const token = raw?.split(";").find(value => value.trim().startsWith(prefix))?.trim().slice(prefix.length); return token ? { Authorization: `Bearer ${token}` } : {}; } catch { return {}; } }, fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); } })] });

if ("serviceWorker" in navigator) window.addEventListener("load", () => { navigator.serviceWorker.register("/service-worker.js").catch(() => undefined); });

createRoot(document.getElementById("root")!).render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><App /></QueryClientProvider></trpc.Provider>);
