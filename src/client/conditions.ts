import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionFailedError } from "../errors.js";

type BuiltCondition = {
	expression?: string;
	names: Record<string, string>;
	values: Record<string, unknown>;
};

export function mergeConditionExpressions(...conditions: BuiltCondition[]): {
	ConditionExpression?: string;
	ExpressionAttributeNames?: Record<string, string>;
	ExpressionAttributeValues?: Record<string, unknown>;
} {
	const expressions = conditions
		.map((c) => c.expression)
		.filter((expr): expr is string => Boolean(expr));

	return {
		ConditionExpression:
			expressions.length > 0
				? expressions.map((expr) => `(${expr})`).join(" AND ")
				: undefined,
		ExpressionAttributeNames: Object.assign(
			{},
			...conditions.map((c) => c.names),
		),
		ExpressionAttributeValues: Object.assign(
			{},
			...conditions.map((c) => c.values),
		),
	};
}

export function buildExistsCondition(): BuiltCondition {
	return {
		expression: "attribute_exists(#entity_id)",
		names: { "#entity_id": "id" },
		values: {},
	};
}

export async function entityExists(
	docClient: DynamoDBDocumentClient,
	tableName: string,
	entityName: string,
	id: string,
): Promise<boolean> {
	const response = await docClient.send(
		new GetCommand({
			TableName: tableName,
			Key: { id, entityType: entityName },
			ProjectionExpression: "#entity_id",
			ExpressionAttributeNames: { "#entity_id": "id" },
		}),
	);
	return Boolean(response.Item);
}

export function wrapConditionFailed(err: unknown, message: string): never {
	if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
		throw new ConditionFailedError(message);
	}
	throw err;
}

export function isConditionOnlyTransactionCancellation(err: unknown): boolean {
	if (!(err instanceof Error) || err.name !== "TransactionCanceledException") {
		return false;
	}

	const cancellationReasons = (
		err as Error & {
			CancellationReasons?: Array<{ Code?: string } | undefined>;
		}
	).CancellationReasons;

	if (!Array.isArray(cancellationReasons) || cancellationReasons.length === 0) {
		return false;
	}

	return cancellationReasons.every((reason) => {
		const code = reason?.Code;
		return (
			code === undefined || code === "None" || code === "ConditionalCheckFailed"
		);
	});
}
