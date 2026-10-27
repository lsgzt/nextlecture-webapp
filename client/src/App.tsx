import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Analytics } from "@vercel/analytics/react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ScrollToTop } from "./components/ScrollToTop";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SyllabusPage from "./pages/SyllabusPage";
import TimetableApp from "./pages/TimetableApp";
import PreviousPapersPage from "./pages/PreviousPapersPage";
import AttendancePage from "./pages/AttendancePage";
import DownloadPage from "./pages/DownloadPage";
import VacantRoomsPage from "./pages/VacantRoomsPage";
import CampusPage from "./pages/CampusPage";
import MarkAttendancePage from "./pages/MarkAttendancePage";
import FacultyMembersPage from "./pages/FacultyMembersPage";
import Learn from "./pages/Learn";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/app" component={TimetableApp} />
      <Route path="/faculty" component={FacultyMembersPage} />
      <Route path="/vacant-rooms" component={VacantRoomsPage} />
      <Route path="/campus" component={CampusPage} />
      <Route path="/attendance" component={AttendancePage} />
      <Route path="/mark-attendance" component={MarkAttendancePage} />
      <Route path="/mark-attendance/:sessionId" component={MarkAttendancePage} />
      <Route path="/syllabus" component={SyllabusPage} />
      <Route path="/papers" component={PreviousPapersPage} />
      <Route path="/download" component={DownloadPage} />
      <Route path="/learn" component={Learn} />
      <Route path="/learn/login" component={Learn} />
      <Route path="/learn/teachers" component={Learn} />
      <Route path="/learn/teachers/:id" component={Learn} />
      <Route path="/learn/courses" component={Learn} />
      <Route path="/learn/profile" component={Learn} />
      <Route path="/learn/watch/:id" component={Learn} />
      <Route path="/learn/admin" component={Learn} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
          <ScrollToTop />
          <Analytics />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
