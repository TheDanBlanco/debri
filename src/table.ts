import type { CreateTableCommandInput } from "@aws-sdk/client-dynamodb";
import {
	BillingMode,
	KeyType,
	ProjectionType,
	ScalarAttributeType,
} from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { createClient } from "./client.js";
import type { EntityDefinition } from "./entity.js";
import type { TableClient } from "./types.js";
import { unwrapSchemaType } from "./utils.js";

type ScalarIndexFieldKeys<T> = {
	[K in keyof T]-?: Extract<T[K], string | number> extends never ? never : K;
}[keyof T] &
	string;

type EntitySchemaFieldNames<TEntity extends EntityDefinition> =
	ScalarIndexFieldKeys<z.infer<TEntity["schema"]>>;

type SchemaFieldNames<TEntities extends readonly EntityDefinition[]> =
	TEntities[number] extends infer TEntity
		? TEntity extends EntityDefinition
			? EntitySchemaFieldNames<TEntity>
			: never
		: never;

type DuplicateEntityNames<
	TEntities extends readonly EntityDefinition[],
	Seen extends string = never,
> = TEntities extends readonly [
	infer Head extends EntityDefinition,
	...infer Tail extends readonly EntityDefinition[],
]
	? Head["name"] extends Seen
		? Head["name"]
		: DuplicateEntityNames<Tail, Seen | Head["name"]>
	: never;

export type IndexFieldName<TEntities extends readonly EntityDefinition[]> =
	| SchemaFieldNames<TEntities>
	| "id"
	| "entityType"
	| "createdAt"
	| "updatedAt";

export interface IndexDefinition<
	TPK extends readonly string[] = readonly string[],
	TSK extends readonly string[] = readonly string[],
> {
	pk: TPK;
	sk?: TSK;
}

export interface ResolvedIndexDefinition<
	TPK extends readonly string[] = readonly string[],
	TSK extends readonly string[] = readonly string[],
> extends IndexDefinition<TPK, TSK> {
	sk: TSK;
}

type NormalizedIndexDefinition<TIndex extends IndexDefinition> =
	ResolvedIndexDefinition<
		TIndex["pk"],
		TIndex["sk"] extends readonly string[] ? TIndex["sk"] : readonly []
	>;

const AUTO_MANAGED_INDEX_FIELDS = new Set([
	"id",
	"entityType",
	"createdAt",
	"updatedAt",
]);

function inferSchemaAttributeType(
	field: z.ZodTypeAny,
): ScalarAttributeType | undefined {
	const inner = unwrapSchemaType(field);
	const literalValue =
		inner instanceof z.ZodLiteral ? Array.from(inner.values)[0] : undefined;

	if (
		inner instanceof z.ZodString ||
		inner instanceof z.ZodEnum ||
		typeof literalValue === "string"
	) {
		return ScalarAttributeType.S;
	}

	if (inner instanceof z.ZodNumber || typeof literalValue === "number") {
		return ScalarAttributeType.N;
	}

	if (inner instanceof z.ZodUnion) {
		const optionTypes = new Set(
			inner.options.map((option) =>
				inferSchemaAttributeType(option as z.ZodTypeAny),
			),
		);
		return optionTypes.size === 1 ? [...optionTypes][0] : undefined;
	}

	return undefined;
}

function getIndexedFieldDefinitions(
	entities: readonly EntityDefinition[],
	attrName: string,
): z.ZodTypeAny[] {
	const definitions: z.ZodTypeAny[] = [];
	for (const ent of entities) {
		const shape = ent.schema.shape as Record<string, z.ZodTypeAny>;
		const field = shape[attrName];
		if (field) {
			definitions.push(field);
		}
	}
	return definitions;
}

/**
 * Infer the DynamoDB attribute type from Zod schemas.
 * If any entity has this field as a ZodNumber, it's N. Otherwise S.
 */
function inferAttributeType(
	entities: readonly EntityDefinition[],
	attrName: string,
): ScalarAttributeType {
	for (const field of getIndexedFieldDefinitions(entities, attrName)) {
		const attributeType = inferSchemaAttributeType(field);
		if (attributeType) {
			return attributeType;
		}
	}
	return ScalarAttributeType.S;
}

function validateIndexes(
	entities: readonly EntityDefinition[],
	indexes: Record<string, IndexDefinition>,
): void {
	for (const [indexName, index] of Object.entries(indexes)) {
		const sk = index.sk ?? [];
		if (index.pk.length === 0) {
			throw new Error(
				`Index ${indexName} must have at least one partition key (pk) attribute`,
			);
		}

		for (const attr of [...index.pk, ...sk]) {
			if (AUTO_MANAGED_INDEX_FIELDS.has(attr)) continue;

			const fields = getIndexedFieldDefinitions(entities, attr);
			if (fields.length === 0) {
				throw new Error(
					`Index ${indexName} references unknown attribute "${attr}"`,
				);
			}

			const typeKinds = new Set(
				fields.map((field) => {
					const attributeType = inferSchemaAttributeType(field);
					if (!attributeType) {
						throw new Error(
							`Index ${indexName} attribute "${attr}" must resolve to a string or number key type`,
						);
					}
					return attributeType;
				}),
			);

			if (typeKinds.size > 1) {
				throw new Error(
					`Index ${indexName} uses attribute "${attr}" with conflicting types across entities`,
				);
			}
		}
	}
}

/**
 * Generate CreateTableCommand input from a table definition.
 */
function buildTableSchema(
	name: string,
	entities: readonly EntityDefinition[],
	indexes: Record<string, IndexDefinition>,
): CreateTableCommandInput {
	validateIndexes(entities, indexes);
	const keyAttrs = new Map<string, ScalarAttributeType>();

	// Base table keys
	keyAttrs.set("id", ScalarAttributeType.S);
	keyAttrs.set("entityType", ScalarAttributeType.S);

	// GSI key attributes
	for (const index of Object.values(indexes)) {
		for (const attr of [...index.pk, ...(index.sk ?? [])]) {
			if (!keyAttrs.has(attr)) {
				keyAttrs.set(attr, inferAttributeType(entities, attr));
			}
		}
	}

	const gsis = Object.entries(indexes).map(([indexName, index]) => {
		const sk = index.sk ?? [];
		return {
			IndexName: `${indexName}Index`,
			KeySchema: [
				...index.pk.map((attr) => ({
					AttributeName: attr,
					KeyType: KeyType.HASH,
				})),
				...sk.map((attr) => ({
					AttributeName: attr,
					KeyType: KeyType.RANGE,
				})),
			],
			Projection: { ProjectionType: ProjectionType.ALL },
		};
	});

	return {
		TableName: name,
		BillingMode: BillingMode.PAY_PER_REQUEST,
		AttributeDefinitions: [...keyAttrs.entries()].map(([attrName, type]) => ({
			AttributeName: attrName,
			AttributeType: type,
		})),
		KeySchema: [
			{ AttributeName: "id", KeyType: KeyType.HASH },
			{ AttributeName: "entityType", KeyType: KeyType.RANGE },
		],
		GlobalSecondaryIndexes: gsis.length > 0 ? gsis : undefined,
	};
}

export interface Table<
	TEntities extends readonly EntityDefinition[],
	TIndexes extends Record<string, IndexDefinition>,
> {
	name: string;
	entities: TEntities;
	indexes: TIndexes;
	ttl?: string;
	tableSchema: () => CreateTableCommandInput;
	/** Returns the `UpdateTimeToLive` input if a `ttl` attribute is configured. */
	ttlConfig: () =>
		| {
				TableName: string;
				TimeToLiveSpecification: {
					AttributeName: string;
					Enabled: true;
				};
		  }
		| undefined;
	connect: (opts: {
		client: DynamoDBDocumentClient;
	}) => TableClient<TEntities, TIndexes>;
}

export function table<
	const TEntities extends readonly EntityDefinition[],
	const TIndexes extends Record<
		string,
		IndexDefinition<
			readonly IndexFieldName<TEntities>[],
			readonly IndexFieldName<TEntities>[]
		>
	>,
>(def: {
	name: string;
	entities: DuplicateEntityNames<TEntities> extends never ? TEntities : never;
	indexes: TIndexes;
	ttl?: string;
}): Table<TEntities, TIndexes> {
	const seenNames = new Set<string>();
	for (const entity of def.entities) {
		if (seenNames.has(entity.name)) {
			throw new Error(`Duplicate entity name "${entity.name}" is not allowed`);
		}
		seenNames.add(entity.name);
	}

	const normalizedIndexes = Object.fromEntries(
		Object.entries(def.indexes).map(([name, index]) => [
			name,
			{ ...index, sk: index.sk ?? [] },
		]),
	) as {
		[K in keyof TIndexes]: NormalizedIndexDefinition<TIndexes[K]>;
	};

	return {
		...def,
		indexes: normalizedIndexes as unknown as TIndexes,
		tableSchema: () =>
			buildTableSchema(def.name, def.entities, normalizedIndexes),
		ttlConfig: () =>
			def.ttl
				? {
						TableName: def.name,
						TimeToLiveSpecification: {
							AttributeName: def.ttl,
							Enabled: true as const,
						},
					}
				: undefined,
		connect: (opts) =>
			createClient(
				def.name,
				def.entities,
				normalizedIndexes,
				opts.client,
			) as unknown as TableClient<TEntities, TIndexes>,
	};
}
