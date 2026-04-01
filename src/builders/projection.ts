export function buildProjectionParams(pick: readonly string[] | undefined): {
	expression?: string;
	names: Record<string, string>;
} {
	if (!pick || pick.length === 0) return { names: {} };

	const allAttrs = new Set([
		...pick,
		"id",
		"entityType",
		"createdAt",
		"updatedAt",
	]);
	const names: Record<string, string> = {};
	const parts: string[] = [];

	for (const attr of allAttrs) {
		const ref = `#proj_${attr}`;
		names[ref] = attr;
		parts.push(ref);
	}

	return {
		expression: parts.join(", "),
		names,
	};
}
