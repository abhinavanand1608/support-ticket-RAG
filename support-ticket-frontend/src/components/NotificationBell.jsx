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

// Lightweight relative-time formatting ("2m ago", "3h ago") instead of a
// full date library - notification dropdowns read better with relative
// times, and the data range here (minutes to a few days old) doesn't
// need anything more sophisticated than a handful of thresholds.
function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function BellIcon() {
  return (
    <svg
      className="notification-bell__icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

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
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notification-bell__count">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-bell__dropdown">
          <div className="notification-bell__header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-bell__mark-all"
                onClick={() => markAllAsRead()}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <p className="notification-bell__empty">You're all caught up.</p>
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
                  <span className="notification-item__dot" aria-hidden="true" />
                  <div className="notification-item__body">
                    <p>{n.message}</p>
                    <span className="notification-item__time">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
