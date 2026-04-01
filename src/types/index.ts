export type {
	BaseFieldKeys,
	CollectionPage,
	CollectionResult,
	ConditionExpression,
	EntityNames,
	FindEntity,
	ItemForName,
	NaturalIdForName,
	Page,
} from "./core.js";
export type {
	AutoManagedFields,
	BuildSKParams,
	CollectionIndexQueryBuilder,
	CollectionOptions,
	CollectionPageForIndex,
	CollectionParams,
	EntityIndexQueryBuilder,
	EntityNamesForIndex,
	FilterExpression,
	FilterOperator,
	IndexQueryBuilderStart,
	PageInput,
	ProjectedItem,
	ProjectionKeys,
	QueryClient,
	QueryOptions,
	QueryParams,
	QueryParamsForItem,
	QueryParamValue,
	RangeCondition,
	RestNever,
	SortDirection,
	PagingMode,
} from "./query.js";
export type {
	FieldUpdate,
	PutInput,
	TransactOperation,
	UpdateInput,
	WriteClient,
	WriteOptions,
} from "./write.js";

import type { EntityDefinition } from "../entity.js";
import type { IndexDefinition } from "../table.js";
import type { QueryClient } from "./query.js";
import type { WriteClient } from "./write.js";

export interface TableClient<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
> extends WriteClient<TEntities>,
		QueryClient<TEntities, TIndexes> {}
