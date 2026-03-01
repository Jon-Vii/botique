import { createContext, useContext } from "react";

export type ToastVariant = "default" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastAction;
}

export interface ToastEntry extends Required<Omit<ToastOptions, "action">> {
  id: number;
  action?: ToastAction;
  state: "entering" | "visible" | "exiting";
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
