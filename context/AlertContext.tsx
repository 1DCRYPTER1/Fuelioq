import React, { createContext, useContext, useState, ReactNode } from 'react';

export type AlertType = 'error' | 'warning' | 'info' | 'success';

export interface AlertConfig {
  type: AlertType;
  title?: string;
  message: string;
  autoDismiss?: boolean;
  duration?: number; // ms
}

interface AlertContextProps {
  alert: AlertConfig | null;
  showAlert: (config: AlertConfig) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertConfig | null>(null);

  const showAlert = (config: AlertConfig) => {
    setAlert(config);
  };

  const hideAlert = () => {
    setAlert(null);
  };

  return (
    <AlertContext.Provider value={{ alert, showAlert, hideAlert }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
