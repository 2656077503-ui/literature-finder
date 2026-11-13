import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const requests = sqliteTable('requests', {
 id: integer('id').primaryKey({ autoIncrement:true }),
 query: text('query').notNull(), contact: text('contact').notNull(),
 status: text('status').notNull().default('待处理'),
 createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
