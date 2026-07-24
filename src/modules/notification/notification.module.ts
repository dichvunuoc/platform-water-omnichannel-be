/**
 * NotificationModule — kết nối notification-be-rs (gRPC Send). Port-adapter:
 * Mock default, Grpc khi NOTIFICATION_GRPC_URL set. Export NOTIFICATION_PORT_TOKEN.
 * (Port + adapter files giữ trong messaging/ — module owns DI registration.)
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_PORT_TOKEN } from './notification.tokens';
import { MockNotificationAdapter } from './mock-notification.adapter';
import { NotificationGrpcAdapter } from './notification-grpc.adapter';
import { KeycloakSaTokenService } from './keycloak-sa-token.service';

@Module({
  providers: [
    KeycloakSaTokenService,
    MockNotificationAdapter,
    NotificationGrpcAdapter,
    {
      provide: NOTIFICATION_PORT_TOKEN,
      useFactory: (
        config: ConfigService,
        mock: MockNotificationAdapter,
        grpc: NotificationGrpcAdapter,
      ) => (config.get<string>('NOTIFICATION_GRPC_URL') ? grpc : mock),
      inject: [ConfigService, MockNotificationAdapter, NotificationGrpcAdapter],
    },
  ],
  exports: [NOTIFICATION_PORT_TOKEN],
})
export class NotificationModule {}
