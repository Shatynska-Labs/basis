CREATE SCHEMA "metrics";
--> statement-breakpoint
CREATE TABLE "metrics"."health_connect_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "health_connect_deliveries_user_id_received_at_index" ON "metrics"."health_connect_deliveries" USING btree ("user_id","received_at");