import type { ConditionExpression } from "../types.js";

const EXPRESSION_KEYWORDS = new Set([
	"and",
	"or",
	"not",
	"between",
	"in",
	"attribute_exists",
	"attribute_not_exists",
	"attribute_type",
	"begins_with",
	"contains",
	"size",
	"if_not_exists",
	"list_append",
]);

export function buildConditionParams(
	condition: ConditionExpression | undefined,
): {
	expression?: string;
	values: Record<string, unknown>;
	names: Record<string, string>;
} {
	if (!condition) return { values: {}, names: {} };

	let expr = condition.expression;
	const conditionNames: Record<string, string> = {};

	const words = expr.match(/\b[a-zA-Z_]\w*\b/g) || [];
	const wordsToReplace = new Set(
		words.filter((word) => !EXPRESSION_KEYWORDS.has(word.toLowerCase())),
	);

	for (const word of wordsToReplace) {
		const regex = new RegExp(`(?<![:#])\\b${word}\\b`, "g");
		if (regex.test(expr)) {
			expr = expr.replace(regex, `#cond_${word}`);
			conditionNames[`#cond_${word}`] = word;
		}
	}

	return {
		expression: expr,
		values: condition.values ?? {},
		names: {
			...(condition.names ?? {}),
			...conditionNames,
		},
	};
}
