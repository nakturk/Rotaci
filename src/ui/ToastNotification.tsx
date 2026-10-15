import React from 'react';
import { useTripStore } from '../trip/tripStore';
import { CheckCircle2 } from 'lucide-react';

export const ToastNotification: React.FC = () => {
  const toastMessage = useTripStore((state) => state.toastMessage);

  if (!toastMessage) return null;

  return (
    <div className="toast-notification-banner">
      <CheckCircle2 size={16} className="text-emerald shrink-0" />
      <span>{toastMessage}</span>
    </div>
  );
};
