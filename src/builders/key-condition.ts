import type { QueryParamValue } from "../types.js";

export function buildKeyCondition(
	params: Record<string, QueryParamValue>,
	indexDef: { pk: readonly string[]; sk: readonly string[] },
): {
	expression: string;
	values: Record<string, string | number>;
	names: Record<string, string>;
} {
	const parts: string[] = [];
	const values: Record<string, string | number> = {};
	const names: Record<string, string> = {};

	let foundRange = false;
	let stopped = false;

	for (const pk of indexDef.pk) {
		const val = params[pk];
		if (val === undefined) {
			throw new Error(`Missing required partition key attribute: ${pk}`);
		}
		if (typeof val === "object" && val !== null) {
			throw new Error(
				`Partition key attribute ${pk} cannot have a range condition.`,
			);
		}

		const ref = `#${pk}`;
		names[ref] = pk;
		parts.push(`${ref} = :${pk}`);
		values[`:${pk}`] = val;
	}

	for (const sk of indexDef.sk) {
		const val = params[sk];

		if (val === undefined) {
			stopped = true;
			continue;
		}

		if (stopped) {
			throw new Error(
				`Cannot skip sort key attributes. "${sk}" was provided but a previous sort key was omitted.`,
			);
		}

		if (foundRange) {
			throw new Error(
				`Range conditions are only supported on the last provided sort key attribute. Cannot add condition for "${sk}".`,
			);
		}

		const ref = `#${sk}`;
		names[ref] = sk;

		if (typeof val === "object" && val !== null) {
			foundRange = true;
			if ("lte" in val) {
				parts.push(`${ref} <= :${sk}`);
				values[`:${sk}`] = val.lte;
			} else if ("lt" in val) {
				parts.push(`${ref} < :${sk}`);
				values[`:${sk}`] = val.lt;
			} else if ("gte" in val) {
				parts.push(`${ref} >= :${sk}`);
				values[`:${sk}`] = val.gte;
			} else if ("gt" in val) {
				parts.push(`${ref} > :${sk}`);
				values[`:${sk}`] = val.gt;
			} else if ("between" in val) {
				const [lo, hi] = val.between;
				parts.push(`${ref} BETWEEN :${sk}lo AND :${sk}hi`);
				values[`:${sk}lo`] = lo;
				values[`:${sk}hi`] = hi;
			} else if ("beginsWith" in val) {
				parts.push(`begins_with(${ref}, :${sk})`);
				values[`:${sk}`] = val.beginsWith;
			}
		} else {
			parts.push(`${ref} = :${sk}`);
			values[`:${sk}`] = val;
		}
	}

	return { expression: parts.join(" AND "), values, names };
}
