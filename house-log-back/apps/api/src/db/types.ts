import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

type Schema = typeof schema;

type TableKeys = {
  [K in keyof Schema]: Schema[K] extends SQLiteTable ? K : never;
}[keyof Schema];

export type DbTableName = Extract<TableKeys, string>;

export type DbSelectModels = {
  [K in DbTableName]: InferSelectModel<Schema[K]>;
};

export type DbInsertModels = {
  [K in DbTableName]: InferInsertModel<Schema[K]>;
};

// Acesso por nome de tabela: DbRow<'users'>, DbInsert<'service_orders'>
export type DbRow<T extends DbTableName> = DbSelectModels[T];
export type DbInsert<T extends DbTableName> = DbInsertModels[T];
