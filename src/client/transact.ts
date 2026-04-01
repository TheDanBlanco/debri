import type {
	DynamoDBDocumentClient,
	TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";
import {
	buildConditionParams,
	buildUpdateExpression,
	mergeNames,
	mergeValues,
	toAwsCondition,
} from "../builders.js";
import type { EntityDefinition } from "../entity.js";
import { ConditionFailedError } from "../errors.js";
import type { ResolvedIndexDefinition } from "../table.js";
import type {
	NaturalIdForName,
	PutInput,
	TableClient,
	TransactOperation,
	UpdateInput,
	WriteOptions,
} from "../types.js";
import {
	buildExistsCondition,
	isConditionOnlyTransactionCancellation,
	mergeConditionExpressions,
} from "./conditions.js";
import { assertEntity, type ClientContext } from "./context.js";
import { buildItemForPut } from "./parsing.js";
import { validateUpdateInput } from "./update-validation.js";

export function createTransactionHandlers<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, ResolvedIndexDefinition>,
>(deps: {
	context: ClientContext<TEntities, TIndexes>;
	docClient: DynamoDBDocumentClient;
}) {
	return {
		tx: {
			put<TName extends TEntities[number]["name"]>(
				entityName: TName,
				item: PutInput<TEntities, TName>,
				options?: WriteOptions,
			): TransactOperation {
				const entity = assertEntity(deps.context, entityName);
				const parsed = (entity.schema as z.ZodObject<z.ZodRawShape>).parse(
					item,
				);
				return {
					type: "put",
					tableName: deps.context.tableName,
					item: buildItemForPut(
						entityName,
						entity,
						parsed as Record<string, unknown>,
					),
					condition: options?.condition,
				};
			},

			update<TName extends TEntities[number]["name"]>(
				entityName: TName,
				id: NaturalIdForName<TEntities, TName>,
				updates: UpdateInput<TEntities, TName>,
				options?: WriteOptions,
			): TransactOperation {
				const entity = assertEntity(deps.context, entityName);
				const keyId = String(id);
				validateUpdateInput(entity, updates as Record<string, unknown>);
				return {
					type: "update",
					tableName: deps.context.tableName,
					key: { id: keyId, entityType: entityName },
					updates: updates as Record<string, unknown>,
					condition: options?.condition,
				};
			},

			delete<TName extends TEntities[number]["name"]>(
				entityName: TName,
				id: NaturalIdForName<TEntities, TName>,
				options?: WriteOptions,
			): TransactOperation {
				assertEntity(deps.context, entityName);
				const keyId = String(id);
				return {
					type: "delete",
					tableName: deps.context.tableName,
					key: { id: keyId, entityType: entityName },
					condition: options?.condition,
				};
			},

			check<TName extends TEntities[number]["name"]>(
				entityName: TName,
				id: NaturalIdForName<TEntities, TName>,
				condition: NonNullable<
					Parameters<TableClient<TEntities, TIndexes>["tx"]["check"]>[2]
				>,
			): TransactOperation {
				assertEntity(deps.context, entityName);
				const keyId = String(id);
				return {
					type: "check",
					tableName: deps.context.tableName,
					key: { id: keyId, entityType: entityName },
					condition,
				};
			},
		},

		async transactWrite(operations: TransactOperation[]): Promise<void> {
			if (operations.length === 0) return;
			if (operations.length > 100) {
				throw new Error(
					`TransactWrite supports up to 100 operations, got ${operations.length}`,
				);
			}

			const transactItems: NonNullable<
				TransactWriteCommandInput["TransactItems"]
			> = operations.map((operation) => {
				switch (operation.type) {
					case "put": {
						return {
							Put: {
								TableName: operation.tableName,
								Item: operation.item,
								...toAwsCondition(buildConditionParams(operation.condition)),
							},
						};
					}
					case "update": {
						const update = buildUpdateExpression(operation.updates);
						const condition = mergeConditionExpressions(
							buildExistsCondition(),
							buildConditionParams(operation.condition),
						);
						return {
							Update: {
								TableName: operation.tableName,
								Key: operation.key,
								UpdateExpression: update.expression,
								ExpressionAttributeValues: mergeValues(
									update.values,
									condition.ExpressionAttributeValues ?? {},
								),
								ExpressionAttributeNames: mergeNames(
									update.names,
									condition.ExpressionAttributeNames ?? {},
								),
								ConditionExpression: condition.ConditionExpression,
							},
						};
					}
					case "delete": {
						return {
							Delete: {
								TableName: operation.tableName,
								Key: operation.key,
								...toAwsCondition(buildConditionParams(operation.condition)),
							},
						};
					}
					case "check": {
						const condition = buildConditionParams(operation.condition);
						return {
							ConditionCheck: {
								TableName: operation.tableName,
								Key: operation.key,
								ConditionExpression: condition.expression!,
								ExpressionAttributeNames: mergeNames(condition.names),
								ExpressionAttributeValues: mergeValues(condition.values),
							},
						};
					}
					default: {
						// @ts-expect-error TypeScript ensures all cases are handled
						throw new Error(`Unknown operation type: ${operation.type}`);
					}
				}
			});

			try {
				await deps.docClient.send(
					new TransactWriteCommand({ TransactItems: transactItems }),
				);
			} catch (err) {
				if (isConditionOnlyTransactionCancellation(err)) {
					throw new ConditionFailedError(
						"Transaction cancelled — one or more conditions failed",
					);
				}
				throw err;
			}
		},
	};
}
