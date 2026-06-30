-- OmniCare Messaging Tables Migration (0001)
-- Creates conversations + messages tables for the OmniCare backend.
-- Production-safe: review before applying; idempotent (IF NOT EXISTS).

-- Conversations table (unified inbox thread — one per customer per channel)
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "customer_channel_id" varchar(255) NOT NULL,
  "channel" varchar(20) NOT NULL,
  "customer_id" varchar(36),
  "ticket_id" varchar(36),
  "status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Messages table (OmniMessage — normalized, channel-agnostic)
CREATE TABLE IF NOT EXISTS "messages" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "conversation_id" varchar(36) NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "channel" varchar(20) NOT NULL,
  "direction" varchar(10) NOT NULL,
  "sender_type" varchar(10) NOT NULL,
  "content" text NOT NULL,
  "external_id" varchar(255),
  "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "conversations_customer_channel_idx" ON "conversations" ("channel", "customer_channel_id", "status");
CREATE INDEX IF NOT EXISTS "conversations_status_idx" ON "conversations" ("status");
CREATE INDEX IF NOT EXISTS "conversations_ticket_id_idx" ON "conversations" ("ticket_id");
