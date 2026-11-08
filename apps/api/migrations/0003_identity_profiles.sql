CREATE TABLE "identity"."profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"time_zone" text,
	"birth_year" smallint,
	"entered_max_heart_rate" smallint,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identity"."profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;