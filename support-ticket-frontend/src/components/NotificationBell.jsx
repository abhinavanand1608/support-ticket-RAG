import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '../features/notifications/notificationsApi';

// Polling (not a websocket/SignalR push) is a deliberate simplification:
// a real-time connection would need its own infrastructure (a hub,
// reconnect handling, auth over the socket) for a feature where a 30s
// delay before a new notification shows up is a perfectly acceptable
// tradeoff at this project's scale.
const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const { data: notifications = [] } = useGetNotificationsQuery(undefined, {
    pollingInterval: POLL_INTERVAL_MS,
  });
  const [markAsRead] = useMarkNotificationReadMutation();
  const [markAllAsRead] = useMarkAllNotificationsReadMutation();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleNotificationClick(notification) {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    if (notification.ticketId) {
      navigate(`/tickets/${notification.ticketId}`);
    }
  }

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell__trigger"
        onClick={() => setIsOpen((open) => !open)}
      >
        Notifications
        {unreadCount > 0 && <span className="badge badge--active">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-bell__dropdown">
          <div className="notification-bell__header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={() => markAllAsRead()}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <p className="status-message">No notifications yet.</p>
          )}

          {notifications.length > 0 && (
            <ul className="notification-bell__list">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={
                    n.isRead
                      ? 'notification-item'
                      : 'notification-item notification-item--unread'
                  }
                  onClick={() => handleNotificationClick(n)}
                >
                  <p>{n.message}</p>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
