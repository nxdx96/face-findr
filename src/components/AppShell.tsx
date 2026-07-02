import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar" aria-label="Face-Findr app header">
        <a className="brand-mark" href="#onboarding" aria-label="Face-Findr home">
          <span aria-hidden="true" className="brand-sparkle">
            FF
          </span>
          <span>
            <strong>Face-Findr</strong>
            <small>Version 2 preview</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#onboarding">Quiz</a>
          <a href="#results">Results</a>
          <a href="#safety">Safety</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
