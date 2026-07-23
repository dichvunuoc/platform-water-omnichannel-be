import { Injectable, Logger } from '@nestjs/common';
import type {
  INotificationPort,
  NotificationSendRequest,
  NotificationSendResult,
} from '../../../domain/ports/notification.port';

/**
 * Mock Notification Adapter — default khi `NOTIFICATION_GRPC_URL` chưa cấu hình.
 * Log yêu cầu gửi, không gọi service thật.
 */
@Injectable()
export class MockNotificationAdapter implements INotificationPort {
  private readonly logger = new Logger(MockNotificationAdapter.name);

  async send(req: NotificationSendRequest): Promise<NotificationSendResult> {
    this.logger.log(
      `[mock] noti templateKey=${req.templateKey} recipients=${req.recipients.length} channels=${(req.channels ?? []).join(',') || '(template)'}`,
    );
    return { sent: true, status: 'mocked' };
  }
}
