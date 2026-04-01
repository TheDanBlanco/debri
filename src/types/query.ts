import type { EntityDefinition } from "../entity.js";
import type { IndexDefinition } from "../table.js";
import type {
	BaseFieldKeys,
	CollectionResult,
	EntityNames,
	ItemForName,
	Page,
} from "./core.js";

type SortKeysForIndex<TIndex extends IndexDefinition> =
	TIndex["sk"] extends readonly string[] ? TIndex["sk"] : readonly [];

type IndexFieldKeys<TIndex extends IndexDefinition> =
	| TIndex["pk"][number]
	| SortKeysForIndex<TIndex>[number];

type EntityCanAppearInIndex<TItem, TIndex extends IndexDefinition> =
	Exclude<
		IndexFieldKeys<TIndex>,
		AutoManagedFields | BaseFieldKeys
	> extends keyof TItem
		? true
		: false;

export type EntityNamesForIndex<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
	TIndexName extends keyof TIndexes,
> = {
	[K in EntityNames<TEntities>]: EntityCanAppearInIndex<
		ItemForName<TEntities, K>,
		TIndexes[TIndexName]
	> extends true
		? K
		: never;
}[EntityNames<TEntities>];

export type CollectionResultForIndex<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
	TIndexName extends keyof TIndexes,
> = Pick<
	CollectionResult<TEntities>,
	EntityNamesForIndex<TEntities, TIndexes, TIndexName>
>;

export type CollectionPageForIndex<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
	TIndexName extends keyof TIndexes,
> = {
	data: CollectionResultForIndex<TEntities, TIndexes, TIndexName>;
	cursor: string | undefined;
};

export type PageInput = {
	cursor?: string | undefined;
	limit?: number | undefined;
};

export type RangeCondition<T> =
	| { lte: T }
	| { lt: T }
	| { gte: T }
	| { gt: T }
	| { between: [T, T] }
	| { beginsWith: string };

export type QueryParamValue = string | number | RangeCondition<string | number>;

export type AutoManagedFields = "entityType";

type FilterValue<T> = Exclude<T, undefined> | null;

type FilterScalarValue<T> = Extract<FilterValue<T>, number | string>;

type FilterStringValue<T> = Extract<Exclude<T, undefined>, string>;

type RejectUndefinedDeep<T> = T extends undefined
	? never
	: T extends readonly (infer U)[]
		? readonly RejectUndefinedDeep<U>[]
		: T extends object
			? { [K in keyof T]: RejectUndefinedDeep<T[K]> }
			: T;

type ScalarKeyValue<T> = Extract<T, string | number>;

type ItemFieldValue<TItem, TKey extends string> = TKey extends keyof TItem
	? TItem[TKey]
	: never;

export type RestNever<T extends readonly string[]> = {
	[K in Exclude<T[number], AutoManagedFields>]?: never;
};

export type BuildSKParams<
	T extends readonly string[],
	TItem,
	AllKeys extends readonly string[] = T,
> = T extends readonly []
	? RestNever<AllKeys>
	: T extends readonly [
				infer Head extends string,
				...infer Tail extends readonly string[],
			]
		? Head extends AutoManagedFields
			? BuildSKParams<Tail, TItem, Tail>
			:
					| RestNever<AllKeys>
					| ({
							[K in Head]: RangeCondition<
								ScalarKeyValue<ItemFieldValue<TItem, K>>
							>;
					  } & RestNever<Tail>)
					| ({
							[K in Head]: ScalarKeyValue<ItemFieldValue<TItem, K>>;
					  } & BuildSKParams<Tail, TItem, Tail>)
		: {
				[K in Exclude<T[number], AutoManagedFields>]?:
					| ScalarKeyValue<ItemFieldValue<TItem, K>>
					| RangeCondition<ScalarKeyValue<ItemFieldValue<TItem, K>>>;
			};

export type QueryParamsForItem<TItem, TIndex extends IndexDefinition> = {
	[K in Exclude<TIndex["pk"][number], AutoManagedFields>]: ScalarKeyValue<
		ItemFieldValue<TItem, K>
	>;
} & BuildSKParams<SortKeysForIndex<TIndex>, TItem>;

export type QueryParams<TIndex extends IndexDefinition> = QueryParamsForItem<
	Record<string, string | number>,
	TIndex
>;

export type CollectionParams<
	TIndexes extends Record<string, IndexDefinition>,
	TName extends string,
> = TName extends keyof TIndexes
	? {
			[K in Exclude<TIndexes[TName]["pk"][number], AutoManagedFields>]:
				| string
				| number;
		} & BuildSKParams<
			SortKeysForIndex<TIndexes[TName]>,
			Record<string, string | number>
		>
	: Record<string, QueryParamValue>;

export type FilterOperator<T> =
	| FilterValue<T>
	| { eq: FilterValue<T> }
	| { neq: FilterValue<T> }
	| { lt: FilterScalarValue<T> }
	| { lte: FilterScalarValue<T> }
	| { gt: FilterScalarValue<T> }
	| { gte: FilterScalarValue<T> }
	| { between: [FilterScalarValue<T>, FilterScalarValue<T>] }
	| { in: FilterValue<T>[] }
	| { exists: boolean }
	| (FilterStringValue<T> extends never
			? never
			: { contains: string } | { beginsWith: string })
	| (T extends unknown[] ? { contains: T[number] } : never);

export type FilterExpression<T> = {
	[K in keyof T]?: FilterOperator<T[K]>;
} & {
	AND?: FilterExpression<T>[];
	OR?: FilterExpression<T>[];
	NOT?: FilterExpression<T>;
};

export type ProjectionKeys<
	TEntities extends readonly EntityDefinition[],
	TName extends string,
> = keyof ItemForName<TEntities, TName> & string;

export type ProjectedItem<
	TItem,
	TPick extends readonly (keyof TItem & string)[] | undefined,
> = TPick extends readonly (infer TKey extends keyof TItem & string)[]
	? Pick<TItem, TKey | Extract<BaseFieldKeys, keyof TItem>>
	: TItem;

export type QueryOptions<
	TEntities extends readonly EntityDefinition[],
	TName extends string,
	TPick extends ReadonlyArray<ProjectionKeys<TEntities, TName>> | undefined =
		| ReadonlyArray<ProjectionKeys<TEntities, TName>>
		| undefined,
> = {
	limit?: number;
	cursor?: string;
	pick?: TPick;
	filter?: FilterExpression<ItemForName<TEntities, TName>>;
	scanForward?: boolean;
};

export type CollectionOptions<TEntities extends readonly EntityDefinition[]> = {
	limit?: number;
	cursor?: string;
	filter?: FilterExpression<ItemForName<TEntities, EntityNames<TEntities>>>;
	scanForward?: boolean;
};

export type SortDirection = "unset" | "asc" | "desc";
export type PagingMode = "unset" | "limit" | "page";

type CollectionItemForIndex<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
	TIndexName extends keyof TIndexes,
> = ItemForName<
	TEntities,
	EntityNamesForIndex<TEntities, TIndexes, TIndexName>
>;

export interface EntityIndexQueryBuilder<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
	TIndexName extends string & keyof TIndexes,
	TName extends EntityNamesForIndex<TEntities, TIndexes, TIndexName>,
	TPick extends ReadonlyArray<ProjectionKeys<TEntities, TName>> | undefined =
		| undefined
		| ReadonlyArray<ProjectionKeys<TEntities, TName>>,
	TSort extends SortDirection = "unset",
	TPaging extends PagingMode = "unset",
> extends PromiseLike<
		Page<ProjectedItem<ItemForName<TEntities, TName>, TPick>>
	> {
	filter<TFilter extends FilterExpression<ItemForName<TEntities, TName>>>(
		filter: TFilter & RejectUndefinedDeep<TFilter>,
	): EntityIndexQueryBuilder<
		TEntities,
		TIndexes,
		TIndexName,
		TName,
		TPick,
		TSort,
		TPaging
	>;

	limit: TPaging extends "unset"
		? (
				limit: number,
			) => EntityIndexQueryBuilder<
				TEntities,
				TIndexes,
				TIndexName,
				TName,
				TPick,
				TSort,
				"limit"
			>
		: never;

	cursor(
		cursor: string,
	): EntityIndexQueryBuilder<
		TEntities,
		TIndexes,
		TIndexName,
		TName,
		TPick,
		TSort,
		TPaging
	>;

	page: TPaging extends "unset"
		? (
				input: PageInput,
			) => EntityIndexQueryBuilder<
				TEntities,
				TIndexes,
				TIndexName,
				TName,
				TPick,
				TSort,
				"page"
			>
		: never;

	asc: TSort extends "unset"
		? () => EntityIndexQueryBuilder<
				TEntities,
				TIndexes,
				TIndexName,
				TName,
				TPick,
				"asc",
				TPaging
			>
		: never;

	desc: TSort extends "unset"
		? () => EntityIndexQueryBuilder<
				TEntities,
				TIndexes,
				TIndexName,
				TName,
				TPick,
				"desc",
				TPaging
			>
		: never;

	pick<TNextPick extends ReadonlyArray<ProjectionKeys<TEntities, TName>>>(
		pick: TNextPick,
	): EntityIndexQueryBuilder<
		TEntities,
		TIndexes,
		TIndexName,
		TName,
		TNextPick,
		TSort,
		TPaging
	>;
}

export interface CollectionIndexQueryBuilder<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
	TIndexName extends string & keyof TIndexes,
	TSort extends SortDirection = "unset",
	TPaging extends PagingMode = "unset",
> extends PromiseLike<CollectionPageForIndex<TEntities, TIndexes, TIndexName>> {
	filter<
		TFilter extends FilterExpression<
			CollectionItemForIndex<TEntities, TIndexes, TIndexName>
		>,
	>(
		filter: TFilter & RejectUndefinedDeep<TFilter>,
	): CollectionIndexQueryBuilder<
		TEntities,
		TIndexes,
		TIndexName,
		TSort,
		TPaging
	>;

	limit: TPaging extends "unset"
		? (
				limit: number,
			) => CollectionIndexQueryBuilder<
				TEntities,
				TIndexes,
				TIndexName,
				TSort,
				"limit"
			>
		: never;

	cursor(
		cursor: string,
	): CollectionIndexQueryBuilder<
		TEntities,
		TIndexes,
		TIndexName,
		TSort,
		TPaging
	>;

	page: TPaging extends "unset"
		? (
				input: PageInput,
			) => CollectionIndexQueryBuilder<
				TEntities,
				TIndexes,
				TIndexName,
				TSort,
				"page"
			>
		: never;

	asc: TSort extends "unset"
		? () => CollectionIndexQueryBuilder<
				TEntities,
				TIndexes,
				TIndexName,
				"asc",
				TPaging
			>
		: never;

	desc: TSort extends "unset"
		? () => CollectionIndexQueryBuilder<
				TEntities,
				TIndexes,
				TIndexName,
				"desc",
				TPaging
			>
		: never;
}

export interface IndexQueryBuilderStart<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
	TIndexName extends string & keyof TIndexes,
> {
	entity<TName extends EntityNamesForIndex<TEntities, TIndexes, TIndexName>>(
		entityName: TName,
	): EntityIndexQueryBuilder<TEntities, TIndexes, TIndexName, TName>;

	collection(): CollectionIndexQueryBuilder<TEntities, TIndexes, TIndexName>;
}

export interface QueryClient<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
> {
	index<TIndexName extends string & keyof TIndexes>(
		indexName: TIndexName,
		params: CollectionParams<TIndexes, TIndexName>,
	): IndexQueryBuilderStart<TEntities, TIndexes, TIndexName>;
}
