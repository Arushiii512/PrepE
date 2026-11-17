import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import DashboardLayout from "@/layouts/DashboardLayout";
import { LoadingState } from "@/components/LoadingState";

// Pages load on demand so the charting library only ships when Insights is opened.
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AskPrepE = lazy(() => import("@/pages/AskPrepE"));
const QuizPrepE = lazy(() => import("@/pages/QuizPrepE"));
const PrepEInsights = lazy(() => import("@/pages/PrepEInsights"));

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Suspense fallback={<LoadingState title="Loading…" className="min-h-[60vh]" />}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="ask" element={<AskPrepE />} />
              <Route path="quiz" element={<QuizPrepE />} />
              <Route path="insights" element={<PrepEInsights />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
