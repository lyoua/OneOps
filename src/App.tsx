import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import SystemMonitoring from "@/pages/SystemMonitoring";
import LogAnalysis from "@/pages/LogAnalysis";
import AlertManagement from "@/pages/AlertManagement";
import ServiceConnectivity from "@/pages/ServiceConnectivity";
import ToolIntegration from "@/pages/ToolIntegration";
import ConfigManagement from "@/pages/ConfigManagement";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/monitoring" element={<SystemMonitoring />} />
          <Route path="/logs" element={<LogAnalysis />} />
          <Route path="/alerts" element={<AlertManagement />} />
          <Route path="/connectivity" element={<ServiceConnectivity />} />
          <Route path="/tools" element={<ToolIntegration />} />
          <Route path="/config" element={<ConfigManagement />} />
        </Routes>
      </Layout>
    </Router>
  );
}
