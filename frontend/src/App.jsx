import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import SuiteEditor from "./pages/SuiteEditor";
import RunDetails from "./pages/RunDetails";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/suites" element={<Dashboard />} />
            <Route path="/suites/new" element={<SuiteEditor />} />
            <Route path="/suites/:suiteId" element={<SuiteEditor />} />
            <Route path="/runs/:runId" element={<RunDetails />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
