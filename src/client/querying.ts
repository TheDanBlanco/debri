import type {
	DynamoDBDocumentClient,
	QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
	buildFilterExpression,
	buildKeyCondition,
	buildProjectionParams,
	mergeNames,
	mergeValues,
} from "../builders.js";
import type { EntityDefinition } from "../entity.js";
import { IndexNotFoundError } from "../errors.js";
import type { ResolvedIndexDefinition } from "../table.js";
import type {
	CollectionIndexQueryBuilder,
	CollectionOptions,
	CollectionPageForIndex,
	CollectionParams,
	CollectionResult,
	EntityIndexQueryBuilder,
	EntityNamesForIndex,
	IndexQueryBuilderStart,
	ItemForName,
	Page,
	PageInput,
	PagingMode,
	ProjectedItem,
	ProjectionKeys,
	QueryOptions,
	QueryParamsForItem,
	QueryParamValue,
	SortDirection,
} from "../types.js";
import { decodeCursor, encodeCursor } from "../utils.js";
import { resolveIndex, type ClientContext } from "./context.js";
import { parseItem } from "./parsing.js";

function applyPageInput<TState extends { cursor?: string; limit?: number }>(
	state: TState,
	input: PageInput,
): TState {
	return {
		...state,
		cursor: input.cursor ?? state.cursor,
		limit: input.limit ?? state.limit,
	};
}

type EntityBuilderState<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, ResolvedIndexDefinition>,
	TIndexName extends string & keyof TIndexes,
	TName extends EntityNamesForIndex<TEntities, TIndexes, TIndexName>,
	TPick extends ReadonlyArray<ProjectionKeys<TEntities, TName>> | undefined,
	TSort extends SortDirection,
	TPaging extends PagingMode,
> = {
	indexName: TIndexName;
	params: QueryParamsForItem<
		ItemForName<TEntities, TName>,
		TIndexes[TIndexName]
	>;
	entityName: TName;
	options?: QueryOptions<TEntities, TName, TPick>;
};

type CollectionBuilderState<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, ResolvedIndexDefinition>,
	TIndexName extends string & keyof TIndexes,
	TSort extends SortDirection,
	TPaging extends PagingMode,
> = {
	indexName: TIndexName;
	params: CollectionParams<TIndexes, TIndexName>;
	options?: CollectionOptions<TEntities>;
};

export function createQueryHandlers<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, ResolvedIndexDefinition>,
>(deps: {
	context: ClientContext<TEntities, TIndexes>;
	docClient: DynamoDBDocumentClient;
}) {
	async function runCollection<TName extends string & keyof TIndexes>(
		indexName: TName,
		params: CollectionParams<TIndexes, TName>,
		options?: CollectionOptions<TEntities>,
	): Promise<CollectionPageForIndex<TEntities, TIndexes, TName>> {
		const indexDef = deps.context.indexes[indexName];
		if (!indexDef) throw new IndexNotFoundError();

		const keyCondition = buildKeyCondition(
			params as Record<string, QueryParamValue>,
			indexDef,
		);
		const filterParams = buildFilterExpression(options?.filter);

		const command: QueryCommandInput = {
			TableName: deps.context.tableName,
			IndexName: `${indexName}Index`,
			KeyConditionExpression: keyCondition.expression,
			FilterExpression: filterParams.expression,
			ExpressionAttributeValues: mergeValues(
				keyCondition.values,
				filterParams.values,
			),
			ExpressionAttributeNames: mergeNames(
				keyCondition.names,
				filterParams.names,
			),
			Limit: options?.limit,
			ScanIndexForward: options?.scanForward,
			ExclusiveStartKey: options?.cursor
				? decodeCursor(options.cursor)
				: undefined,
		};

		const response = await deps.docClient.send(new QueryCommand(command));
		const result = {} as Record<string, unknown[]>;

		for (const entity of deps.context.entities) {
			result[entity.name] = [];
		}

		for (const raw of response.Items ?? []) {
			const entityType = (raw as Record<string, unknown>).entityType as string;
			const schema = deps.context.fullSchemas.get(entityType);
			if (schema && result[entityType]) {
				result[entityType].push(schema.parse(raw));
			}
		}

		return {
			data: result as CollectionResult<TEntities>,
			cursor: response.LastEvaluatedKey
				? encodeCursor(response.LastEvaluatedKey as Record<string, unknown>)
				: undefined,
		} as CollectionPageForIndex<TEntities, TIndexes, TName>;
	}

	async function runQuery<
		TIndexName extends string & keyof TIndexes,
		TName extends EntityNamesForIndex<TEntities, TIndexes, TIndexName>,
		TPick extends ReadonlyArray<ProjectionKeys<TEntities, TName>> | undefined,
	>(
		entityName: TName,
		indexName: TIndexName,
		params: QueryParamsForItem<
			ItemForName<TEntities, TName>,
			TIndexes[TIndexName]
		>,
		options?: QueryOptions<TEntities, TName, TPick>,
	): Promise<Page<ProjectedItem<ItemForName<TEntities, TName>, TPick>>> {
		const { indexName: ddbIndexName, indexDef } = resolveIndex(
			{ indexes: deps.context.indexes },
			indexName,
		);

		const queryParams = { ...(params as Record<string, QueryParamValue>) };
		if (
			(indexDef.pk.includes("entityType") ||
				indexDef.sk.includes("entityType")) &&
			!("entityType" in queryParams)
		) {
			queryParams.entityType = entityName;
		}

		const keyCondition = buildKeyCondition(queryParams, indexDef);
		const shouldFilterEntityType =
			!indexDef.pk.includes("entityType") &&
			!indexDef.sk.includes("entityType");
		const filterParams = buildFilterExpression(options?.filter);
		const projection = buildProjectionParams(options?.pick);

		const filterParts: string[] = [];
		const filterNames: Record<string, string> = { ...filterParams.names };
		const filterValues: Record<string, unknown> = { ...filterParams.values };
		if (filterParams.expression) filterParts.push(filterParams.expression);
		if (shouldFilterEntityType) {
			filterParts.push("#query_entityType = :query_entityType");
			filterNames["#query_entityType"] = "entityType";
			filterValues[":query_entityType"] = entityName;
		}

		const command: QueryCommandInput = {
			TableName: deps.context.tableName,
			IndexName: ddbIndexName,
			KeyConditionExpression: keyCondition.expression,
			FilterExpression: filterParts.join(" AND ") || undefined,
			ExpressionAttributeValues: mergeValues(
				keyCondition.values,
				filterValues,
			),
			ExpressionAttributeNames: mergeNames(
				keyCondition.names,
				projection.names,
				filterNames,
			),
			ProjectionExpression: projection.expression,
			Limit: options?.limit,
			ScanIndexForward: options?.scanForward,
			ExclusiveStartKey: options?.cursor
				? decodeCursor(options.cursor)
				: undefined,
		};

		const response = await deps.docClient.send(new QueryCommand(command));
		const items = (response.Items ?? []).map((raw) =>
			parseItem(
				{
					entityNames: deps.context.entityNames,
					fullSchemas: deps.context.fullSchemas,
				},
				entityName,
				raw as Record<string, unknown>,
				options?.pick as readonly string[] | undefined,
			),
		) as ProjectedItem<ItemForName<TEntities, TName>, TPick>[];

		return {
			items,
			cursor: response.LastEvaluatedKey
				? encodeCursor(response.LastEvaluatedKey as Record<string, unknown>)
				: undefined,
		};
	}

	function createEntityBuilder<
		TIndexName extends string & keyof TIndexes,
		TName extends EntityNamesForIndex<TEntities, TIndexes, TIndexName>,
		TPick extends
			| ReadonlyArray<ProjectionKeys<TEntities, TName>>
			| undefined = undefined,
		TSort extends SortDirection = "unset",
		TPaging extends PagingMode = "unset",
	>(
		state: EntityBuilderState<
			TEntities,
			TIndexes,
			TIndexName,
			TName,
			TPick,
			TSort,
			TPaging
		>,
	): EntityIndexQueryBuilder<
		TEntities,
		TIndexes,
		TIndexName,
		TName,
		TPick,
		TSort,
		TPaging
	> {
		const builder = {
			filter<
				TFilter extends NonNullable<
					QueryOptions<TEntities, TName, TPick>["filter"]
				>,
			>(filter: TFilter) {
				return createEntityBuilder({
					...state,
					options: { ...state.options, filter },
				});
			},
			limit(limit: number) {
				return createEntityBuilder<TIndexName, TName, TPick, TSort, "limit">({
					...state,
					options: { ...state.options, limit },
				});
			},
			cursor(cursor: string) {
				return createEntityBuilder({
					...state,
					options: { ...state.options, cursor },
				});
			},
			page(input: PageInput) {
				return createEntityBuilder<TIndexName, TName, TPick, TSort, "page">({
					...state,
					options: applyPageInput(state.options ?? {}, input),
				});
			},
			asc() {
				return createEntityBuilder<TIndexName, TName, TPick, "asc", TPaging>({
					...state,
					options: { ...state.options, scanForward: true },
				});
			},
			desc() {
				return createEntityBuilder<TIndexName, TName, TPick, "desc", TPaging>({
					...state,
					options: { ...state.options, scanForward: false },
				});
			},
			pick<TNextPick extends ReadonlyArray<ProjectionKeys<TEntities, TName>>>(
				pick: TNextPick,
			) {
				return createEntityBuilder<TIndexName, TName, TNextPick>({
					...state,
					options: { ...state.options, pick },
				});
			},
			// biome-ignore lint/suspicious/noThenProperty: Query builders are intentionally thenable for await support.
			then<
				TResult1 = Page<ProjectedItem<ItemForName<TEntities, TName>, TPick>>,
				TResult2 = never,
			>(
				onfulfilled?:
					| ((
							value: Page<ProjectedItem<ItemForName<TEntities, TName>, TPick>>,
					  ) => TResult1 | PromiseLike<TResult1>)
					| null,
				onrejected?:
					| ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
					| null,
			): PromiseLike<TResult1 | TResult2> {
				return (
					runQuery(
						state.entityName,
						state.indexName,
						state.params,
						state.options,
					) as Promise<
						Page<ProjectedItem<ItemForName<TEntities, TName>, TPick>>
					>
				).then(onfulfilled, onrejected);
			},
		};

		return builder as unknown as EntityIndexQueryBuilder<
			TEntities,
			TIndexes,
			TIndexName,
			TName,
			TPick,
			TSort,
			TPaging
		>;
	}

	function createCollectionBuilder<
		TIndexName extends string & keyof TIndexes,
		TSort extends SortDirection = "unset",
		TPaging extends PagingMode = "unset",
	>(
		state: CollectionBuilderState<
			TEntities,
			TIndexes,
			TIndexName,
			TSort,
			TPaging
		>,
	): CollectionIndexQueryBuilder<
		TEntities,
		TIndexes,
		TIndexName,
		TSort,
		TPaging
	> {
		const builder = {
			filter<
				TFilter extends NonNullable<CollectionOptions<TEntities>["filter"]>,
			>(filter: TFilter) {
				return createCollectionBuilder({
					...state,
					options: { ...state.options, filter },
				});
			},
			limit(limit: number) {
				return createCollectionBuilder<TIndexName, TSort, "limit">({
					...state,
					options: { ...state.options, limit },
				});
			},
			cursor(cursor: string) {
				return createCollectionBuilder({
					...state,
					options: { ...state.options, cursor },
				});
			},
			page(input: PageInput) {
				return createCollectionBuilder<TIndexName, TSort, "page">({
					...state,
					options: applyPageInput(state.options ?? {}, input),
				});
			},
			asc() {
				return createCollectionBuilder<TIndexName, "asc", TPaging>({
					...state,
					options: { ...state.options, scanForward: true },
				});
			},
			desc() {
				return createCollectionBuilder<TIndexName, "desc", TPaging>({
					...state,
					options: { ...state.options, scanForward: false },
				});
			},
			// biome-ignore lint/suspicious/noThenProperty: Query builders are intentionally thenable for await support.
			then<
				TResult1 = CollectionPageForIndex<TEntities, TIndexes, TIndexName>,
				TResult2 = never,
			>(
				onfulfilled?:
					| ((
							value: CollectionPageForIndex<TEntities, TIndexes, TIndexName>,
					  ) => TResult1 | PromiseLike<TResult1>)
					| null,
				onrejected?:
					| ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
					| null,
			): PromiseLike<TResult1 | TResult2> {
				return (
					runCollection(
						state.indexName,
						state.params,
						state.options,
					) as Promise<CollectionPageForIndex<TEntities, TIndexes, TIndexName>>
				).then(onfulfilled, onrejected);
			},
		};

		return builder as unknown as CollectionIndexQueryBuilder<
			TEntities,
			TIndexes,
			TIndexName,
			TSort,
			TPaging
		>;
	}

	return {
		index<TIndexName extends string & keyof TIndexes>(
			indexName: TIndexName,
			params: CollectionParams<TIndexes, TIndexName>,
		): IndexQueryBuilderStart<TEntities, TIndexes, TIndexName> {
			return {
				entity(entityName) {
					return createEntityBuilder({
						indexName,
						params: params as unknown as QueryParamsForItem<
							ItemForName<TEntities, typeof entityName>,
							TIndexes[TIndexName]
						>,
						entityName,
					});
				},
				collection() {
					return createCollectionBuilder({ indexName, params });
				},
			};
		},
	};
}
