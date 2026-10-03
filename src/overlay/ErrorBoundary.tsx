import { Component, type ReactNode } from "react";
import { recordError } from "@/engine/diagnosticsEngine";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retryAt: number | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryAt: null };
  }

  static getDerivedStateFromError(): State {
    return { hasError: false, retryAt: null };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    recordError(`Overlay render error: ${error} at ${info.componentStack}`, "ErrorBoundary");
    this.setState({ hasError: true, retryAt: Date.now() + 5000 });
    this.retryTimer = setTimeout(() => {
      this.setState({ hasError: false, retryAt: null });
    }, 5000);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            fontFamily: "system-ui, sans-serif",
            color: "rgba(150, 160, 180, 0.5)",
            fontSize: "12px",
          }}
        >
          Kovy encountered an issue — recovering...
        </div>
      );
    }
    return this.props.children;
  }
}
