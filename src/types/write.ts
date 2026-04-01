import type { z } from "zod";
import type { EntityDefinition } from "../entity.js";
import type { op } from "../operations.js";
import type {
	ConditionExpression,
	EntityNames,
	FindEntity,
	ItemForName,
	NaturalIdForName,
} from "./core.js";

export type PutInput<
	TEntities extends readonly EntityDefinition[],
	TName extends string,
> = z.input<FindEntity<TEntities, TName>["schema"]>;

export type FieldUpdate<T> =
	| T
	| (T extends number ? ReturnType<typeof op.add> : never)
	| (T extends unknown[]
			? ReturnType<typeof op.append | typeof op.prepend>
			: never)
	| (undefined extends T ? ReturnType<typeof op.remove> : never);

export type UpdateInput<
	TEntities extends readonly EntityDefinition[],
	TName extends string,
> = {
	[K in keyof Omit<
		z.infer<FindEntity<TEntities, TName>["schema"]>,
		FindEntity<TEntities, TName>["id"]
	>]?: FieldUpdate<z.infer<FindEntity<TEntities, TName>["schema"]>[K]>;
};

export type WriteOptions = {
	condition?: ConditionExpression;
};

export type TransactOperation =
	| {
			type: "put";
			tableName: string;
			item: Record<string, unknown>;
			condition?: ConditionExpression;
	  }
	| {
			type: "update";
			tableName: string;
			key: Record<string, unknown>;
			updates: Record<string, unknown>;
			condition?: ConditionExpression;
	  }
	| {
			type: "delete";
			tableName: string;
			key: Record<string, unknown>;
			condition?: ConditionExpression;
	  }
	| {
			type: "check";
			tableName: string;
			key: Record<string, unknown>;
			condition: ConditionExpression;
	  };

export interface WriteClient<TEntities extends readonly EntityDefinition[]> {
	put<TName extends EntityNames<TEntities>>(
		entityName: TName,
		item: PutInput<TEntities, TName>,
		options?: WriteOptions,
	): Promise<ItemForName<TEntities, TName>>;

	get<TName extends EntityNames<TEntities>>(
		entityName: TName,
		id: NaturalIdForName<TEntities, TName>,
	): Promise<ItemForName<TEntities, TName> | undefined>;

	update<TName extends EntityNames<TEntities>>(
		entityName: TName,
		id: NaturalIdForName<TEntities, TName>,
		updates: UpdateInput<TEntities, TName>,
		options?: WriteOptions,
	): Promise<ItemForName<TEntities, TName>>;

	delete<TName extends EntityNames<TEntities>>(
		entityName: TName,
		id: NaturalIdForName<TEntities, TName>,
		options?: WriteOptions,
	): Promise<void>;

	batchPut<TName extends EntityNames<TEntities>>(
		entityName: TName,
		items: PutInput<TEntities, TName>[],
	): Promise<ItemForName<TEntities, TName>[]>;

	batchDelete<TName extends EntityNames<TEntities>>(
		entityName: TName,
		ids: NaturalIdForName<TEntities, TName>[],
	): Promise<void>;

	tx: {
		put<TName extends EntityNames<TEntities>>(
			entityName: TName,
			item: PutInput<TEntities, TName>,
			options?: WriteOptions,
		): TransactOperation;

		update<TName extends EntityNames<TEntities>>(
			entityName: TName,
			id: NaturalIdForName<TEntities, TName>,
			updates: UpdateInput<TEntities, TName>,
			options?: WriteOptions,
		): TransactOperation;

		delete<TName extends EntityNames<TEntities>>(
			entityName: TName,
			id: NaturalIdForName<TEntities, TName>,
			options?: WriteOptions,
		): TransactOperation;

		check<TName extends EntityNames<TEntities>>(
			entityName: TName,
			id: NaturalIdForName<TEntities, TName>,
			condition: ConditionExpression,
		): TransactOperation;
	};

	transactWrite(operations: TransactOperation[]): Promise<void>;
}
