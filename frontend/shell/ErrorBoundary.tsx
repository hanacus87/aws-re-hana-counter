import { Component, type ReactNode } from "react";
import { Flower } from "./icons";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <header className="header">
            <a href="/" className="home-link" aria-label="ホームへ">
              <Flower />
            </a>
          </header>
          <main className="notfound">500</main>
        </>
      );
    }
    return this.props.children;
  }
}
