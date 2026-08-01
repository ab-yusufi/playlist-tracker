import { Navigate, Route, Routes } from "react-router";

import { ProtectedRoute, PublicOnlyRoute } from "./components/RouteGuards.jsx";

import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PlaylistPage from "./pages/PlaylistPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />

        <Route path="/playlists/:playlistId" element={<PlaylistPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
