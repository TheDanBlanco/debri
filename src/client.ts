import type {
	DeleteCommandInput,
	DynamoDBDocumentClient,
	PutCommandInput,
	UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";
import {
	buildConditionParams,
	buildUpdateExpression,
	mergeNames,
	mergeValues,
	toAwsCondition,
} from "./builders.js";
import { createBatchHandlers } from "./client/batch.js";
import {
	buildExistsCondition,
	entityExists,
	mergeConditionExpressions,
	wrapConditionFailed,
} from "./client/conditions.js";
import { assertEntity, createClientContext } from "./client/context.js";
import { buildItemForPut, parseItem } from "./client/parsing.js";
import { createQueryHandlers } from "./client/querying.js";
import { createTransactionHandlers } from "./client/transact.js";
import { validateUpdateInput } from "./client/update-validation.js";
import type { EntityDefinition } from "./entity.js";
import { EntityNotFoundError } from "./errors.js";
import type { ResolvedIndexDefinition } from "./table.js";
import type { ItemForName, TableClient } from "./types.js";

export function createClient<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, ResolvedIndexDefinition>,
>(
	tableName: string,
	entities: TEntities,
	indexes: TIndexes,
	docClient: DynamoDBDocumentClient,
): TableClient<TEntities, TIndexes> {
	const context = createClientContext(tableName, entities, indexes);
	const queryHandlers = createQueryHandlers({ context, docClient });
	const batchHandlers = createBatchHandlers({ context, docClient });
	const transactionHandlers = createTransactionHandlers({
		context,
		docClient,
	});

	return {
		async put(entityName, item, options) {
			const entity = assertEntity(context, entityName);
			const parsed = (entity.schema as z.ZodObject<z.ZodRawShape>).parse(item);
			const fullItem = buildItemForPut(
				entityName,
				entity,
				parsed as Record<string, unknown>,
			);
			const condition = buildConditionParams(options?.condition);

			const command: PutCommandInput = {
				TableName: tableName,
				Item: fullItem,
				...toAwsCondition(condition),
			};

			try {
				await docClient.send(new PutCommand(command));
			} catch (err) {
				wrapConditionFailed(err, `Condition failed on put for ${entityName}`);
			}

			return parseItem(context, entityName, fullItem) as ItemForName<
				TEntities,
				typeof entityName
			>;
		},

		async get(entityName, id) {
			assertEntity(context, entityName);
			const keyId = String(id);
			const response = await docClient.send(
				new GetCommand({
					TableName: tableName,
					Key: { id: keyId, entityType: entityName },
				}),
			);

			if (!response.Item) return undefined;
			return parseItem(
				context,
				entityName,
				response.Item as Record<string, unknown>,
			) as ItemForName<TEntities, typeof entityName>;
		},

		async update(entityName, id, updates, options) {
			const entity = assertEntity(context, entityName);
			const keyId = String(id);
			validateUpdateInput(entity, updates as Record<string, unknown>);
			const update = buildUpdateExpression(updates as Record<string, unknown>);
			const condition = mergeConditionExpressions(
				buildExistsCondition(),
				buildConditionParams(options?.condition),
			);

			const command: UpdateCommandInput = {
				TableName: tableName,
				Key: { id: keyId, entityType: entityName },
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
				ReturnValues: "ALL_NEW",
			};

			try {
				const response = await docClient.send(new UpdateCommand(command));
				if (!response.Attributes) {
					throw new EntityNotFoundError(entityName, keyId);
				}
				return parseItem(
					context,
					entityName,
					response.Attributes as Record<string, unknown>,
				) as ItemForName<TEntities, typeof entityName>;
			} catch (err) {
				if (
					err instanceof Error &&
					err.name === "ConditionalCheckFailedException" &&
					!(await entityExists(docClient, tableName, entityName, keyId))
				) {
					throw new EntityNotFoundError(entityName, keyId);
				}
				wrapConditionFailed(
					err,
					`Condition failed on update for ${entityName}#${keyId} — item exists but the provided condition did not match`,
				);
			}
		},

		async delete(entityName, id, options) {
			assertEntity(context, entityName);
			const keyId = String(id);
			const condition = buildConditionParams(options?.condition);

			const command: DeleteCommandInput = {
				TableName: tableName,
				Key: { id: keyId, entityType: entityName },
				...toAwsCondition(condition),
			};

			try {
				await docClient.send(new DeleteCommand(command));
			} catch (err) {
				wrapConditionFailed(
					err,
					`Condition failed on delete for ${entityName}#${keyId}`,
				);
			}
		},

		index: queryHandlers.index,
		batchPut: batchHandlers.batchPut,
		batchDelete: batchHandlers.batchDelete,
		tx: transactionHandlers.tx as TableClient<TEntities, TIndexes>["tx"],
		transactWrite: transactionHandlers.transactWrite,
	};
}
