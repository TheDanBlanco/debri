import { describe, expect, it } from "vitest";
import { z } from "zod";
import { entity } from "../../entity.js";
import { table } from "../../table.js";
import { TestTable } from "../setup.js";

describe("tableSchema", () => {
	it("should generate correct attribute definitions", () => {
		const schema = TestTable.tableSchema();

		expect(schema.TableName).toBe(TestTable.name);
		expect(schema.BillingMode).toBe("PAY_PER_REQUEST");

		const attrNames = schema.AttributeDefinitions?.map((a) => a.AttributeName);
		expect(attrNames).toContain("id");
		expect(attrNames).toContain("entityType");
		expect(attrNames).toContain("listingId");
		expect(attrNames).toContain("price");
		expect(attrNames).toContain("agentId");

		const priceAttr = schema.AttributeDefinitions?.find(
			(a) => a.AttributeName === "price",
		);
		expect(priceAttr?.AttributeType).toBe("N");
	});

	it("should generate 4 GSIs", () => {
		const schema = TestTable.tableSchema();
		expect(schema.GlobalSecondaryIndexes).toHaveLength(4);

		const gsiNames = schema.GlobalSecondaryIndexes?.map((g) => g.IndexName);
		expect(gsiNames).toContain("allListingsIndex");
		expect(gsiNames).toContain("listingIndex");
		expect(gsiNames).toContain("browseIndex");
		expect(gsiNames).toContain("agentIndex");
	});

	it("should generate multi-attribute key schemas", () => {
		const schema = TestTable.tableSchema();
		const browseGsi = schema.GlobalSecondaryIndexes?.find(
			(g) => g.IndexName === "browseIndex",
		);

		const hashKeys = browseGsi?.KeySchema?.filter((k) => k.KeyType === "HASH");
		const rangeKeys = browseGsi?.KeySchema?.filter(
			(k) => k.KeyType === "RANGE",
		);

		expect(hashKeys).toHaveLength(2);
		expect(hashKeys?.map((k) => k.AttributeName)).toEqual([
			"zipCode",
			"status",
		]);
		expect(rangeKeys).toHaveLength(1);
		expect(rangeKeys?.[0]?.AttributeName).toBe("price");
	});

	it("should throw error if an index has no pk", () => {
		const badTable = table({
			name: "BadTable",
			entities: [],
			indexes: {
				badIndex: { pk: [], sk: [] },
			},
		});

		expect(() => badTable.tableSchema()).toThrow(
			"Index badIndex must have at least one partition key (pk) attribute",
		);
	});

	it("should set GlobalSecondaryIndexes to undefined if no indexes", () => {
		const emptyTable = table({
			name: "EmptyTable",
			entities: [],
			indexes: {},
		});

		const schema = emptyTable.tableSchema();
		expect(schema.GlobalSecondaryIndexes).toBeUndefined();
	});

	it("should return ttlConfig when ttl is configured", () => {
		const tbl = table({
			name: "TtlTable",
			entities: [],
			indexes: {},
			ttl: "expiresAt",
		});

		const config = tbl.ttlConfig();
		expect(config).toEqual({
			TableName: "TtlTable",
			TimeToLiveSpecification: {
				AttributeName: "expiresAt",
				Enabled: true,
			},
		});
	});

	it("should return undefined from ttlConfig when ttl is not configured", () => {
		const tbl = table({
			name: "NoTtlTable",
			entities: [],
			indexes: {},
		});

		expect(tbl.ttlConfig()).toBeUndefined();
	});

	it("should infer N type for numeric optional field", () => {
		const ent = entity({
			name: "TEST",
			id: "testId",
			schema: z.object({
				testId: z.string(),
				optNum: z.number().optional(),
			}),
		});

		const tbl = table({
			name: "NumTable",
			entities: [ent],
			indexes: {
				idx: { pk: ["testId"], sk: ["optNum"] },
			},
		});

		const schema = tbl.tableSchema();
		const optNumAttr = schema.AttributeDefinitions?.find(
			(a) => a.AttributeName === "optNum",
		);
		expect(optNumAttr?.AttributeType).toBe("N");
	});

	it("should throw when an index references an unknown attribute", () => {
		const ent = entity({
			name: "TEST",
			id: "testId",
			schema: z.object({
				testId: z.string(),
			}),
		});

		const tbl = table({
			name: "BadIndexTable",
			entities: [ent],
			indexes: {
				idx: { pk: ["missingAttr" as never], sk: [] },
			},
		});

		expect(() => tbl.tableSchema()).toThrow(
			'Index idx references unknown attribute "missingAttr"',
		);
	});

	it("should throw when indexed attributes have conflicting types", () => {
		const textEntity = entity({
			name: "TEXT",
			id: "id",
			schema: z.object({
				id: z.string(),
				shared: z.string(),
			}),
		});
		const numberEntity = entity({
			name: "NUMBER",
			id: "id",
			schema: z.object({
				id: z.string(),
				shared: z.number(),
			}),
		});

		const tbl = table({
			name: "ConflictingIndexTable",
			entities: [textEntity, numberEntity],
			indexes: {
				idx: { pk: ["shared"], sk: [] },
			},
		});

		expect(() => tbl.tableSchema()).toThrow(
			'Index idx uses attribute "shared" with conflicting types across entities',
		);
	});

	it("should infer string type for enum-backed indexed attributes", () => {
		const schema = TestTable.tableSchema();
		const statusAttr = schema.AttributeDefinitions?.find(
			(attr) => attr.AttributeName === "status",
		);

		expect(statusAttr?.AttributeType).toBe("S");
	});

	it("should throw when an indexed attribute resolves to a non-scalar type", () => {
		const ent = entity({
			name: "BAD",
			id: "id",
			schema: z.object({
				id: z.string(),
				badKey: z.array(z.string()),
			}),
		});

		const tbl = table({
			name: "BadScalarIndexTable",
			entities: [ent],
			indexes: {
				idx: { pk: ["badKey" as never], sk: [] },
			},
		});

		expect(() => tbl.tableSchema()).toThrow(
			'Index idx attribute "badKey" must resolve to a string or number key type',
		);
	});

	it("should support PK-only indexes by normalizing sk to an empty array", () => {
		const ent = entity({
			name: "ONLY",
			id: "onlyId",
			schema: z.object({
				onlyId: z.string(),
			}),
		});

		const tbl = table({
			name: "PkOnlyTable",
			entities: [ent],
			indexes: {
				all: { pk: ["entityType"] },
			},
		});

		expect("sk" in tbl.indexes.all).toBe(true);
		expect(tbl.indexes.all).toMatchObject({ sk: [] });
		expect(tbl.tableSchema().GlobalSecondaryIndexes?.[0]?.KeySchema).toEqual([
			{ AttributeName: "entityType", KeyType: "HASH" },
		]);
	});

	it("should reject duplicate entity names at runtime", () => {
		const one = entity({
			name: "DUPE",
			id: "id",
			schema: z.object({ id: z.string() }),
		});
		const two = entity({
			name: "DUPE",
			id: "otherId",
			schema: z.object({ otherId: z.string() }),
		});

		expect(() =>
			table({
				name: "DuplicateNamesRuntime",
				entities: [one, two] as never,
				indexes: {},
			}),
		).toThrow('Duplicate entity name "DUPE" is not allowed');
	});
});
