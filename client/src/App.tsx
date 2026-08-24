import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Analytics } from "@vercel/analytics/react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SyllabusPage from "./pages/SyllabusPage";
import TimetableApp from "./pages/TimetableApp";
import PreviousPapersPage from "./pages/PreviousPapersPage";
import AttendancePage from "./pages/AttendancePage";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/app" component={TimetableApp} /><Route path="/attendance" component={AttendancePage} /><Route path="/syllabus" component={SyllabusPage} /><Route path="/papers" component={PreviousPapersPage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><Router /><Analytics /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
