import { z } from "zod";
import type { EntityDefinition, EntityItem } from "../entity.js";
import { UnknownEntityError } from "../errors.js";
import type { ProjectedItem } from "../types.js";
import type { ClientContext } from "./context.js";

export function parseItem<
	TName extends string,
	TPick extends readonly string[] | undefined = undefined,
>(
	context: Pick<ClientContext, "entityNames" | "fullSchemas">,
	entityName: TName,
	raw: Record<string, unknown>,
	pickedFields?: TPick,
): ProjectedItem<EntityItem<EntityDefinition<TName>>, TPick> {
	const schema = context.fullSchemas.get(entityName);
	if (!schema) throw new UnknownEntityError(entityName, context.entityNames);

	if (pickedFields) {
		const pickConfig = Object.fromEntries(
			[...pickedFields, "id", "entityType", "createdAt", "updatedAt"].map(
				(field) => [field, true],
			),
		) as Record<string, true>;
		const partialSchema = (schema as z.ZodObject<z.ZodRawShape>).pick(
			pickConfig,
		);
		return partialSchema.parse(raw) as ProjectedItem<
			EntityItem<EntityDefinition<TName>>,
			TPick
		>;
	}

	return schema.parse(raw) as ProjectedItem<
		EntityItem<EntityDefinition<TName>>,
		TPick
	>;
}

export function buildItemForPut(
	entityName: string,
	entity: EntityDefinition,
	item: Record<string, unknown>,
): Record<string, unknown> {
	const now = new Date().toISOString();
	return {
		...item,
		id: String(item[entity.id]),
		entityType: entityName,
		createdAt: now,
		updatedAt: now,
	};
}
