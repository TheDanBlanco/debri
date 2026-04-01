import { z } from "zod";
import type { EntityDefinition } from "../entity.js";
import { IndexNotFoundError, UnknownEntityError } from "../errors.js";
import type { ResolvedIndexDefinition } from "../table.js";

export interface ClientContext<
	TEntities extends readonly EntityDefinition[] = readonly EntityDefinition[],
	TIndexes extends Record<string, ResolvedIndexDefinition> = Record<
		string,
		ResolvedIndexDefinition
	>,
> {
	tableName: string;
	entities: TEntities;
	indexes: TIndexes;
	entityNames: string[];
	entityMap: Map<string, EntityDefinition>;
	fullSchemas: Map<string, z.ZodType>;
}

export function createClientContext<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, ResolvedIndexDefinition>,
>(
	tableName: string,
	entities: TEntities,
	indexes: TIndexes,
): ClientContext<TEntities, TIndexes> {
	const entityNames = entities.map((entity) => entity.name);
	const entityMap = new Map<string, EntityDefinition>();
	const fullSchemas = new Map<string, z.ZodType>();

	for (const entity of entities) {
		entityMap.set(entity.name, entity);
		fullSchemas.set(
			entity.name,
			(entity.schema as z.ZodObject<z.ZodRawShape>).extend({
				id: z.string(),
				entityType: z.literal(entity.name),
				createdAt: z.string(),
				updatedAt: z.string(),
			}),
		);
	}

	return {
		tableName,
		entities,
		indexes,
		entityNames,
		entityMap,
		fullSchemas,
	};
}

export function assertEntity(
	context: Pick<ClientContext, "entityMap" | "entityNames">,
	entityName: string,
): EntityDefinition {
	const entity = context.entityMap.get(entityName);
	if (!entity) throw new UnknownEntityError(entityName, context.entityNames);
	return entity;
}

export function resolveIndex(
	context: Pick<ClientContext, "indexes">,
	indexName: string,
): { indexName: string; indexDef: ResolvedIndexDefinition } {
	const indexDef = context.indexes[indexName];
	if (!indexDef) throw new IndexNotFoundError();
	return { indexName: `${indexName}Index`, indexDef };
}
