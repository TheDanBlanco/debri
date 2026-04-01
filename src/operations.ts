export const OP_BRAND = Symbol.for("debri.operation");

export const op = {
	add: (value: number) => ({ [OP_BRAND]: "add" as const, value }),
	remove: () => ({ [OP_BRAND]: "remove" as const }),
	append: <T>(value: T[]) => ({ [OP_BRAND]: "append" as const, value }),
	prepend: <T>(value: T[]) => ({ [OP_BRAND]: "prepend" as const, value }),
};

export type Operation = ReturnType<
	typeof op.add | typeof op.remove | typeof op.append | typeof op.prepend
>;

export function isOperation(val: unknown): val is Operation {
	return typeof val === "object" && val !== null && OP_BRAND in val;
}
