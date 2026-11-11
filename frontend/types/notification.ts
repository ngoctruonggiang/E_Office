export type NotificationKind = "info" | "success" | "warning" | "error";

export type AppNotification = {
  id: string;
  title: string;
  message?: string;
  kind: NotificationKind;
  createdAt: number;
  read: boolean;
};

export type NotifyInput = {
  title: string;
  message?: string;
  kind?: NotificationKind;
  /** ms before the popup toast auto-dismisses; 0 keeps it until dismissed. */
  duration?: number;
};
