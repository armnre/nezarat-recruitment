ALTER TABLE "tenants" ADD COLUMN "hostname" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_hostname_unique" UNIQUE("hostname");