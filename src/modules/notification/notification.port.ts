/**
 * Notification Port — gửi thông báo qua platform notification-be-rs.
 *
 * Hexagonal port (clone pattern IFieldTeamPort). Mock default → gRPC Send thật khi
 * `NOTIFICATION_GRPC_URL` cấu hình. KHÔNG gọi provider trực tiếp — qua contract
 * platform (spec `app-tu-phuc-vu/docs/06-notification.md`).
 */
export interface INotificationPort {
  send(request: NotificationSendRequest): Promise<NotificationSendResult>;
}

export interface NotificationRecipient {
  userId?: string; // Keycloak user UUID → kênh noti/in-app
  phone?: string; // → kênh sms
  email?: string; // → kênh email
}

export interface NotificationSendRequest {
  templateKey: string; // <domain>.<entity>.<action>, vd cskh.broadcast
  recipients: NotificationRecipient[];
  channels?: string[]; // 'email' | 'sms' | 'noti'; rỗng = theo template
  data?: Record<string, unknown>; // biến template (NĐ13: chỉ đưa biến cần)
  idempotencyKey?: string; // chống gửi trùng (bus at-least-once)
}

export interface NotificationSendResult {
  sent: boolean;
  notificationId?: string;
  status?: string; // 'queued' | 'duplicate' | 'fallback' | 'mocked'
  error?: string;
}
