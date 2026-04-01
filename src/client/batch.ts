import type {
	BatchWriteCommandInput,
	DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";
import type { EntityDefinition } from "../entity.js";
import type { ResolvedIndexDefinition } from "../table.js";
import type { ItemForName, NaturalIdForName, PutInput } from "../types.js";
import { assertEntity, type ClientContext } from "./context.js";
import { buildItemForPut, parseItem } from "./parsing.js";

async function writeBatchWithRetries(
	docClient: DynamoDBDocumentClient,
	tableName: string,
	requests: NonNullable<BatchWriteCommandInput["RequestItems"]>[string],
): Promise<void> {
	let chunk = requests;
	let retries = 0;

	while (chunk.length > 0) {
		const response = await docClient.send(
			new BatchWriteCommand({
				RequestItems: {
					[tableName]: chunk,
				},
			}),
		);

		const unprocessed = response.UnprocessedItems?.[tableName];
		if (!unprocessed || unprocessed.length === 0) {
			break;
		}

		chunk = unprocessed;
		retries++;
		if (retries > 3) {
			throw new Error(
				`Failed to process ${chunk.length} items after 3 retries`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** retries));
	}
}

export function createBatchHandlers<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, ResolvedIndexDefinition>,
>(deps: {
	context: ClientContext<TEntities, TIndexes>;
	docClient: DynamoDBDocumentClient;
}) {
	return {
		async batchPut<TName extends TEntities[number]["name"]>(
			entityName: TName,
			items: PutInput<TEntities, TName>[],
		): Promise<ItemForName<TEntities, TName>[]> {
			const entity = assertEntity(deps.context, entityName);
			const fullItems: Record<string, unknown>[] = [];

			for (const item of items) {
				const parsed = (entity.schema as z.ZodObject<z.ZodRawShape>).parse(
					item,
				);
				fullItems.push(
					buildItemForPut(
						entityName,
						entity,
						parsed as Record<string, unknown>,
					),
				);
			}

			for (let i = 0; i < fullItems.length; i += 25) {
				const chunk = fullItems.slice(i, i + 25).map((fullItem) => ({
					PutRequest: { Item: fullItem },
				}));
				await writeBatchWithRetries(
					deps.docClient,
					deps.context.tableName,
					chunk,
				);
			}

			return fullItems.map((fullItem) =>
				parseItem(deps.context, entityName, fullItem),
			) as ItemForName<TEntities, TName>[];
		},

		async batchDelete<TName extends TEntities[number]["name"]>(
			entityName: TName,
			ids: NaturalIdForName<TEntities, TName>[],
		): Promise<void> {
			assertEntity(deps.context, entityName);

			for (let i = 0; i < ids.length; i += 25) {
				const chunk = ids.slice(i, i + 25).map((itemId) => ({
					DeleteRequest: {
						Key: { id: String(itemId), entityType: entityName },
					},
				}));
				await writeBatchWithRetries(
					deps.docClient,
					deps.context.tableName,
					chunk,
				);
			}
		},
	};
}
