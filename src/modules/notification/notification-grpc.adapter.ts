import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type {
  INotificationPort,
  NotificationSendRequest,
  NotificationSendResult,
} from './notification.port';
import { KeycloakSaTokenService } from './keycloak-sa-token.service';

/**
 * Live Notification adapter — gửi qua notification-be-rs gRPC
 * (`notification.v1.NotificationService/Send`). Config-gated bởi `NOTIFICATION_GRPC_URL`:
 *  - set → gRPC Send (SA token qua metadata khi KEYCLOAK_SA_* cấu hình; else không auth
 *    — works với AUTH_ENABLED=false dev path).
 *  - unset → fallback `{sent:true}` (dev, chưa wire platform).
 *
 * Spec: `app-tu-phuc-vu/docs/06-notification.md`. Port-adapter pattern (clone
 * `IFieldTeamPort` style).
 */
@Injectable()
export class NotificationGrpcAdapter implements INotificationPort {
  private readonly logger = new Logger('notification-grpc-adapter');
  private client: grpc.Client | null = null;
  private readonly grpcUrl?: string;
  private readonly tenantId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly tokens: KeycloakSaTokenService,
  ) {
    this.grpcUrl = this.config.get<string>('NOTIFICATION_GRPC_URL');
    this.tenantId = this.config.get<string>(
      'NOTIFICATION_TENANT_ID',
      'tnt_hawaco',
    );
    if (this.grpcUrl) this.initClient();
  }

  private initClient(): void {
    const protoPath = path.resolve(
      process.cwd(),
      'src/libs/shared/proto/notification.proto',
    );
    const pkgDef = protoLoader.loadSync(protoPath, {
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      keepCase: true, // giữ field names snake_case như proto (template_key, tenant_id…)
    });
    const proto = grpc.loadPackageDefinition(pkgDef) as unknown as {
      notification: {
        v1: {
          NotificationService: new (
            addr: string,
            creds: grpc.ChannelCredentials,
          ) => grpc.Client;
        };
      };
    };
    this.client = new proto.notification.v1.NotificationService(
      this.grpcUrl as string,
      grpc.credentials.createInsecure(),
    );
    this.logger.log(`gRPC client → ${this.grpcUrl}`);
  }

  async send(req: NotificationSendRequest): Promise<NotificationSendResult> {
    if (!this.grpcUrl || !this.client) {
      this.logger.log(
        `[dev fallback] noti templateKey=${req.templateKey} (NOTIFICATION_GRPC_URL unset)`,
      );
      return { sent: true, status: 'fallback' };
    }

    const token = await this.tokens.getToken().catch((err: Error) => {
      this.logger.warn(
        `SA token unavailable, sending without auth: ${err.message}`,
      );
      return null;
    });
    const metadata = new grpc.Metadata();
    if (token) metadata.set('authorization', `Bearer ${token}`);

    const request = {
      template_key: req.templateKey,
      tenant_id: this.tenantId,
      recipients: req.recipients.map((r) => ({
        user_id: r.userId ?? '',
        phone: r.phone ?? '',
        email: r.email ?? '',
      })),
      channels: req.channels ?? [],
      data_json: JSON.stringify(req.data ?? {}),
      locale: '',
      idempotency_key: req.idempotencyKey ?? '',
    };

    return new Promise<NotificationSendResult>((resolve) => {
      (
        this.client as unknown as {
          Send: (
            req: unknown,
            meta: grpc.Metadata,
            cb: (e: Error | null, r: unknown) => void,
          ) => void;
        }
      ).Send(request, metadata, (err, reply) => {
        if (err) {
          this.logger.warn(
            `gRPC Send failed (templateKey=${req.templateKey}): ${err.message}`,
          );
          resolve({ sent: false, error: err.message });
          return;
        }
        const r = reply as { notification_id: string; status: string };
        this.logger.log(
          `Noti sent: ${r.notification_id} (${r.status}) templateKey=${req.templateKey}`,
        );
        resolve({
          sent: true,
          notificationId: r.notification_id,
          status: r.status,
        });
      });
    });
  }
}
