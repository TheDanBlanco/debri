import type {
	EntityDefinition,
	EntityItem,
	EntityNaturalId,
} from "../entity.js";

export type BaseFieldKeys = "id" | "entityType" | "createdAt" | "updatedAt";

export type ConditionExpression = {
	expression: string;
	values?: Record<string, unknown>;
	names?: Record<string, string>;
};

export type Page<T> = {
	items: T[];
	cursor: string | undefined;
};

export type EntityNames<TEntities extends readonly EntityDefinition[]> =
	TEntities[number]["name"];

export type FindEntity<
	TEntities extends readonly EntityDefinition[],
	TName extends string,
> = Extract<TEntities[number], { name: TName }>;

export type ItemForName<
	TEntities extends readonly EntityDefinition[],
	TName extends string,
> = EntityItem<FindEntity<TEntities, TName>>;

export type NaturalIdForName<
	TEntities extends readonly EntityDefinition[],
	TName extends string,
> = EntityNaturalId<FindEntity<TEntities, TName>>;

export type CollectionResult<TEntities extends readonly EntityDefinition[]> = {
	[K in TEntities[number]["name"]]: ItemForName<TEntities, K>[];
};

export type CollectionPage<TEntities extends readonly EntityDefinition[]> = {
	data: CollectionResult<TEntities>;
	cursor: string | undefined;
};
