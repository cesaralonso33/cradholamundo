CREATE TABLE "AuditLog" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"username" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" text,
	"ip" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Constancia" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"file_path" text,
	"file_name" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Employee" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"email" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "InventoryMovement" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"note" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "LocationHistory" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"from_location" text,
	"to_location" text NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "LoginAttempt" (
	"identifier" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp (3),
	"last_attempt" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PapeleriaItem" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PapeleriaOrderItem" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"papeleria_item_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "PapeleriaOrder" (
	"id" text PRIMARY KEY NOT NULL,
	"folio" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	"closed_at" timestamp (3),
	"closed_by" text
);
--> statement-breakpoint
CREATE TABLE "Product" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"location" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text[] NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"totp_secret" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Constancia" ADD CONSTRAINT "Constancia_employee_id_Employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."Employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_product_id_Product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "LocationHistory" ADD CONSTRAINT "LocationHistory_product_id_Product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."Product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PapeleriaOrderItem" ADD CONSTRAINT "PapeleriaOrderItem_order_id_PapeleriaOrder_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."PapeleriaOrder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PapeleriaOrderItem" ADD CONSTRAINT "PapeleriaOrderItem_papeleria_item_id_PapeleriaItem_id_fk" FOREIGN KEY ("papeleria_item_id") REFERENCES "public"."PapeleriaItem"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PapeleriaOrder" ADD CONSTRAINT "PapeleriaOrder_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "AuditLog" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "AuditLog" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "constancias_employee_id_created_at_idx" ON "Constancia" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE INDEX "employees_name_idx" ON "Employee" USING btree ("name");--> statement-breakpoint
CREATE INDEX "employees_created_at_idx" ON "Employee" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_product_id_idx" ON "InventoryMovement" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_created_at_idx" ON "InventoryMovement" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "location_histories_product_id_created_at_idx" ON "LocationHistory" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_blocked_until_idx" ON "LoginAttempt" USING btree ("blocked_until");--> statement-breakpoint
CREATE UNIQUE INDEX "papeleria_items_name_key" ON "PapeleriaItem" USING btree ("name");--> statement-breakpoint
CREATE INDEX "papeleria_items_name_idx" ON "PapeleriaItem" USING btree ("name");--> statement-breakpoint
CREATE INDEX "papeleria_order_items_order_id_idx" ON "PapeleriaOrderItem" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "papeleria_orders_folio_key" ON "PapeleriaOrder" USING btree ("folio");--> statement-breakpoint
CREATE INDEX "papeleria_orders_user_id_created_at_idx" ON "PapeleriaOrder" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "papeleria_orders_status_idx" ON "PapeleriaOrder" USING btree ("status");--> statement-breakpoint
CREATE INDEX "papeleria_orders_created_at_idx" ON "PapeleriaOrder" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_key" ON "Product" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_sku_idx" ON "Product" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_location_updated_at_idx" ON "Product" USING btree ("location","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_key" ON "Role" USING btree ("name");--> statement-breakpoint
CREATE INDEX "roles_name_idx" ON "Role" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "User" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "User" USING btree ("username");