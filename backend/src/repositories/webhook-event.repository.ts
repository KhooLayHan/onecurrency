import { eq } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import {
  type NewWebhookEvent,
  type WebhookEvent,
  webhookEvents,
} from "../db/schema/webhook-events";

export class WebhookEventRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  findByStripeEventId(
    stripeEventId: string
  ): ResultAsync<WebhookEvent | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.webhookEvents.findFirst({
        where: eq(webhookEvents.stripeEventId, stripeEventId),
      }),
      (e): InternalError =>
        new InternalError("Failed to fetch webhook event from database", {
          cause: e,
          context: { stripeEventId },
        })
    ).map((event) => event ?? null);
  }

  create(data: NewWebhookEvent): ResultAsync<WebhookEvent, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .insert(webhookEvents)
        .values(data)
        .returning()
        .then((rows) => rows[0]),
      (e): InternalError =>
        new InternalError("Failed to create webhook event record", {
          cause: e,
          context: { stripeEventId: data.stripeEventId },
        })
    ).andThen((event) => {
      if (!event) {
        return errAsync(
          new InternalError("Webhook event not returned after insert", {
            context: { stripeEventId: data.stripeEventId },
          })
        );
      }
      return okAsync(event);
    });
  }

  markProcessed(stripeEventId: string): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(webhookEvents)
        .set({ processedAt: new Date() })
        .where(eq(webhookEvents.stripeEventId, stripeEventId))
        .then(() => {
          return;
        }),
      (e): InternalError =>
        new InternalError("Failed to mark webhook event as processed", {
          cause: e,
          context: { stripeEventId },
        })
    );
  }
}
