import { isOperation, OP_BRAND } from "../operations.js";

export function buildUpdateExpression(updates: Record<string, unknown>): {
	expression: string;
	values: Record<string, unknown>;
	names: Record<string, string>;
} {
	const entries = Object.entries(updates).filter(
		([, value]) => value !== undefined,
	);
	entries.push(["updatedAt", new Date().toISOString()]);

	if (entries.length <= 1) {
		throw new Error("No fields to update");
	}

	const setExprs: string[] = [];
	const removeExprs: string[] = [];
	const addExprs: string[] = [];
	const values: Record<string, unknown> = {};
	const names: Record<string, string> = {};

	for (const [key, value] of entries) {
		const nameRef = `#upd_${key}`;
		const valRef = `:upd_${key}`;
		names[nameRef] = key;

		if (isOperation(value)) {
			if (value[OP_BRAND] === "remove") {
				removeExprs.push(nameRef);
			} else if (value[OP_BRAND] === "add") {
				addExprs.push(`${nameRef} ${valRef}`);
				values[valRef] = value.value;
			} else if (value[OP_BRAND] === "append") {
				setExprs.push(
					`${nameRef} = list_append(if_not_exists(${nameRef}, :upd_emptyList), ${valRef})`,
				);
				values[valRef] = value.value;
				values[":upd_emptyList"] = [];
			} else if (value[OP_BRAND] === "prepend") {
				setExprs.push(
					`${nameRef} = list_append(${valRef}, if_not_exists(${nameRef}, :upd_emptyList))`,
				);
				values[valRef] = value.value;
				values[":upd_emptyList"] = [];
			}
		} else {
			setExprs.push(`${nameRef} = ${valRef}`);
			values[valRef] = value;
		}
	}

	const parts: string[] = [];
	if (setExprs.length > 0) parts.push(`SET ${setExprs.join(", ")}`);
	if (addExprs.length > 0) parts.push(`ADD ${addExprs.join(", ")}`);
	if (removeExprs.length > 0) parts.push(`REMOVE ${removeExprs.join(", ")}`);

	return {
		expression: parts.join(" "),
		values,
		names,
	};
}
