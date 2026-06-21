import { createRoot } from "react-dom/client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import App from "./App";
import "./index.css";

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Arlo render error", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-[#0C0E07] px-6 py-16 text-[#EEE4C4]">
        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
          <div className="mb-2 text-4xl">Arlo<span className="text-[#D8AA3E]">.</span></div>
          <p className="mb-8 text-sm text-[#9C9272]">
            Something failed while opening your dashboard.
          </p>
          <button
            className="rounded-xl border border-[#D8AA3E] bg-[#D8AA3E] px-6 py-3 text-sm font-semibold text-[#0C0E07]"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);
