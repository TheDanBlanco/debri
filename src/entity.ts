import { z } from "zod";

type RequiredKeys<T> = {
	[K in keyof T]-?: undefined extends T[K]
		? never
		: Pick<T, K> extends Required<Pick<T, K>>
			? K
			: never;
}[keyof T];

type ScalarLike = string | number;

type ScalarRequiredKeys<T> = {
	[K in RequiredKeys<T>]-?: Extract<T[K], ScalarLike> extends never ? never : K;
}[RequiredKeys<T>] &
	string;

/**
 * An entity definition: a named Zod schema with a natural ID field.
 *
 * The `name` becomes the `entityType` value stored in DynamoDB.
 * The `id` field name tells the library which schema attribute to copy into `id` (the base table partition key).
 */
export interface EntityDefinition<
	TName extends string = string,
	TSchema extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
	TId extends string & keyof z.infer<TSchema> = string & keyof z.infer<TSchema>,
> {
	name: TName;
	schema: TSchema;
	id: TId;
}

/** Base fields auto-added to every item by the library. */
export type BaseFields<TName extends string> = {
	id: string;
	entityType: TName;
	createdAt: string;
	updatedAt: string;
};

/** The full item shape: entity schema fields + auto-generated base fields. */
export type EntityItem<E extends EntityDefinition> = z.infer<E["schema"]> &
	BaseFields<E["name"]>;

export type EntityNaturalId<E extends EntityDefinition> = z.infer<
	E["schema"]
>[E["id"]];

export function entity<
	TName extends string,
	TSchema extends z.ZodObject<z.ZodRawShape>,
	TId extends ScalarRequiredKeys<z.infer<TSchema>>,
>(def: {
	name: TName;
	schema: TSchema;
	id: TId;
}): EntityDefinition<TName, TSchema, TId> {
	const field = def.schema.shape[def.id];
	if (!field) {
		throw new Error(`Entity ${def.name} is missing id field "${def.id}"`);
	}
	if (
		field instanceof z.ZodOptional ||
		field instanceof z.ZodNullable ||
		field instanceof z.ZodDefault
	) {
		throw new Error(`Entity ${def.name} id field "${def.id}" must be required`);
	}
	return def;
}
