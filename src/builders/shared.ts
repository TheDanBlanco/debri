export function mergeNames(
	...maps: Record<string, string>[]
): Record<string, string> | undefined {
	const merged = Object.assign({}, ...maps);
	return Object.keys(merged).length ? merged : undefined;
}

export function mergeValues(
	...maps: Record<string, unknown>[]
): Record<string, unknown> | undefined {
	const merged = Object.assign({}, ...maps);
	return Object.keys(merged).length ? merged : undefined;
}

/**
 * Maps internal `{ expression, names, values }` to AWS SDK condition fields.
 */
export function toAwsCondition(built: {
	expression?: string;
	names: Record<string, string>;
	values: Record<string, unknown>;
}): {
	ConditionExpression?: string;
	ExpressionAttributeNames?: Record<string, string>;
	ExpressionAttributeValues?: Record<string, unknown>;
} {
	return {
		ConditionExpression: built.expression,
		ExpressionAttributeNames: mergeNames(built.names),
		ExpressionAttributeValues: mergeValues(built.values),
	};
}
