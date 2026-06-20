import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth/auth";
import { ErrorBoundary } from "./shell/ErrorBoundary";
import { Shell } from "./shell/Shell";

export { ErrorBoundary };

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Shell />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
