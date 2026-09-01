"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  onError?: ((error: Error) => void) | undefined;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 렌더 중 에러(예: 지도 SDK 로드 실패 — react-naver-maps는 use(promise)로 throw)를 잡는다.
 * 라우트 단위 에러는 app/error.tsx가 담당.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  override componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error) return this.props.fallback(error, this.reset);
    return this.props.children;
  }
}
