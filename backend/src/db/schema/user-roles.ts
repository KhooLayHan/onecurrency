import {
  bigint,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// Note: Foreign key constraints referencing users table are commented out
// until Better-Auth integration is complete. Uncomment and enable when
// the users table is available.

export const userRoles = pgTable(
  "user_roles",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    // FK to users.id - will be enabled after Better-Auth integration
    // userId: bigint("user_id", { mode: "bigint" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    // FK to roles.id
    // roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    roleId: integer("role_id").notNull(),
    // FK to users.id (admin who granted the role)
    // grantedByUserId: bigint("granted_by_user_id").references(() => users.id),
    grantedByUserId: bigint("granted_by_user_id", { mode: "bigint" }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint to prevent duplicate role assignments
    unique("uq_user_role").on(table.userId, table.roleId),
    // Indexes for query optimization
    index("idx_user_roles_user").on(table.userId),
    index("idx_user_roles_role").on(table.roleId),
    index("idx_user_roles_granted_by").on(table.grantedByUserId),
  ]
);

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
