import { z } from "zod";

export function unwrapSchemaType(field: z.ZodTypeAny): z.ZodTypeAny {
	let current = field;
	while (
		current instanceof z.ZodOptional ||
		current instanceof z.ZodNullable ||
		current instanceof z.ZodDefault
	) {
		current = current.unwrap() as z.ZodTypeAny;
	}
	return current as z.ZodTypeAny;
}

export function encodeCursor(lastKey: Record<string, unknown>): string {
	return Buffer.from(JSON.stringify(lastKey)).toString("base64url");
}

export function decodeCursor(cursor: string): Record<string, unknown> {
	return JSON.parse(
		Buffer.from(cursor, "base64url").toString("utf-8"),
	) as Record<string, unknown>;
}

type DefinedValue<T> = Exclude<T, undefined>;

export type WhereDefined<T extends Record<string, unknown>> = {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
	[K in keyof T as undefined extends T[K] ? K : never]?: DefinedValue<T[K]>;
};

export function whereDefined<T extends Record<string, unknown>>(
	input: T,
): WhereDefined<T> {
	const output: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined) {
			output[key] = value;
		}
	}

	return output as WhereDefined<T>;
}
