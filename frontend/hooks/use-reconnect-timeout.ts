"use client";
import { useEffect } from "react";
import { useConnection, useDisconnect } from "wagmi";

const RECONNECT_TIMEOUT_MS = 8000;
export function useReconnectTimeout(): void {
  const { status } = useConnection();
  const { disconnect } = useDisconnect();
  useEffect(() => {
    if (status !== "reconnecting") {
      return;
    }
    const timeout = setTimeout(() => {
      disconnect();
    }, RECONNECT_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [status, disconnect]);
}
