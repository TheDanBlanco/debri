import { z } from "zod";
import type { EntityDefinition } from "../entity.js";
import { isOperation, OP_BRAND } from "../operations.js";
import { unwrapSchemaType } from "../utils.js";

function isOptionalSchema(field: z.ZodTypeAny): boolean {
	return field instanceof z.ZodOptional || field instanceof z.ZodDefault;
}

export function validateUpdateInput(
	entity: EntityDefinition,
	updates: Record<string, unknown>,
): void {
	const shape = (entity.schema as z.ZodObject<z.ZodRawShape>).shape as Record<
		string,
		z.ZodTypeAny
	>;
	const plainUpdates: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(updates)) {
		if (key === entity.id) {
			throw new Error(`Cannot update natural ID field "${entity.id}"`);
		}
		const field = shape[key];
		if (!field) {
			throw new Error(`Unknown update field "${key}"`);
		}

		if (!isOperation(value)) {
			plainUpdates[key] = value;
			continue;
		}

		const unwrappedField = unwrapSchemaType(field);
		const opBrand = (value as { [OP_BRAND]: string })[OP_BRAND];

		if (opBrand === "add" && !(unwrappedField instanceof z.ZodNumber)) {
			throw new Error(`Field "${key}" does not support op.add()`);
		}
		if (
			(opBrand === "append" || opBrand === "prepend") &&
			!(unwrappedField instanceof z.ZodArray)
		) {
			throw new Error(`Field "${key}" does not support list operations`);
		}
		if (opBrand === "remove" && !isOptionalSchema(field)) {
			throw new Error(`Field "${key}" cannot be removed`);
		}
	}

	if (Object.keys(plainUpdates).length > 0) {
		const partialSchema = (entity.schema as z.ZodObject<z.ZodRawShape>)
			.omit({ [entity.id]: true } as Record<string, true>)
			.partial();
		partialSchema.parse(plainUpdates);
	}
}
