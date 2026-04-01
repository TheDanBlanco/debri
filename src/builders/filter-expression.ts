const COMPARISON_OPS: [string, string][] = [
	["eq", "="],
	["neq", "<>"],
	["lt", "<"],
	["lte", "<="],
	["gt", ">"],
	["gte", ">="],
];

export function buildFilterExpression(
	filter: Record<string, unknown> | undefined,
): {
	expression?: string;
	names: Record<string, string>;
	values: Record<string, unknown>;
} {
	if (!filter || Object.keys(filter).length === 0) {
		return { names: {}, values: {} };
	}

	const names: Record<string, string> = {};
	const values: Record<string, unknown> = {};
	let valueCounter = 0;

	function invalidUndefined(path: string): never {
		throw new Error(
			`Invalid filter at "${path}": received undefined. Omit the field instead.`,
		);
	}

	function nextValId() {
		valueCounter++;
		return `:fval${valueCounter}`;
	}

	function parseNode(node: Record<string, unknown>, path = "filter"): string[] {
		const parts: string[] = [];

		for (const [key, val] of Object.entries(node)) {
			if (val === undefined) {
				invalidUndefined(`${path}.${key}`);
			}

			if (key === "AND" || key === "OR") {
				if (Array.isArray(val) && val.length > 0) {
					const subParts = val
						.map((value, index) => {
							if (value === undefined) {
								invalidUndefined(`${path}.${key}[${index}]`);
							}
							const res = parseNode(
								value as Record<string, unknown>,
								`${path}.${key}[${index}]`,
							);
							return res.length > 1 ? `(${res.join(" AND ")})` : res[0];
						})
						.filter(Boolean);
					if (subParts.length > 0) {
						parts.push(`(${subParts.join(` ${key} `)})`);
					}
				}
			} else if (key === "NOT") {
				const res = parseNode(val as Record<string, unknown>, `${path}.NOT`);
				if (res.length > 0) {
					parts.push(`NOT (${res.join(" AND ")})`);
				}
			} else {
				const ref = `#f_${key}`;

				if (val !== null && typeof val === "object" && !Array.isArray(val)) {
					const valObj = val as Record<string, unknown>;
					const matched = COMPARISON_OPS.find(([op]) => op in valObj);
					if (matched) {
						const [op, symbol] = matched;
						if (valObj[op] === undefined) invalidUndefined(`${path}.${key}.${op}`);
						names[ref] = key;
						const vId = nextValId();
						parts.push(`${ref} ${symbol} ${vId}`);
						values[vId] = valObj[op];
					} else if ("between" in valObj) {
						const betweenArr = valObj.between as unknown[];
						if (
							!Array.isArray(betweenArr) ||
							betweenArr.length !== 2 ||
							betweenArr[0] === undefined ||
							betweenArr[1] === undefined
						) {
							invalidUndefined(`${path}.${key}.between`);
						}
						names[ref] = key;
						const v1 = nextValId();
						const v2 = nextValId();
						parts.push(`${ref} BETWEEN ${v1} AND ${v2}`);
						values[v1] = betweenArr[0];
						values[v2] = betweenArr[1];
					} else if ("in" in valObj) {
						const rawInValues = valObj.in as unknown[];
						if (rawInValues.some((item) => item === undefined)) {
							invalidUndefined(`${path}.${key}.in`);
						}
						const inParts = rawInValues.map((item) => {
							const vId = nextValId();
							values[vId] = item;
							return vId;
						});
						if (inParts.length > 0) {
							names[ref] = key;
							parts.push(`${ref} IN (${inParts.join(", ")})`);
						}
					} else if ("exists" in valObj) {
						names[ref] = key;
						parts.push(
							valObj.exists
								? `attribute_exists(${ref})`
								: `attribute_not_exists(${ref})`,
						);
					} else if ("contains" in valObj) {
						if (valObj.contains === undefined) {
							invalidUndefined(`${path}.${key}.contains`);
						}
						names[ref] = key;
						const vId = nextValId();
						parts.push(`contains(${ref}, ${vId})`);
						values[vId] = valObj.contains;
					} else if ("beginsWith" in valObj) {
						if (valObj.beginsWith === undefined) {
							invalidUndefined(`${path}.${key}.beginsWith`);
						}
						names[ref] = key;
						const vId = nextValId();
						parts.push(`begins_with(${ref}, ${vId})`);
						values[vId] = valObj.beginsWith;
					}
				} else if (val === null) {
					names[ref] = key;
					const vId = nextValId();
					parts.push(`${ref} = ${vId}`);
					values[vId] = null;
				} else {
					names[ref] = key;
					const vId = nextValId();
					parts.push(`${ref} = ${vId}`);
					values[vId] = val;
				}
			}
		}

		return parts;
	}

	const topLevelParts = parseNode(filter);

	return {
		expression:
			topLevelParts.length > 0 ? topLevelParts.join(" AND ") : undefined,
		names,
		values,
	};
}
