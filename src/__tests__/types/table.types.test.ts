import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { entity, table } from "../../index.js";

describe("table index typing", () => {
	it("restricts index fields to known schema and managed attributes", () => {
		const Example = entity({
			name: "EXAMPLE",
			id: "exampleId",
			schema: z.object({
				exampleId: z.string(),
				status: z.enum(["ACTIVE", "INACTIVE"]),
				price: z.number(),
			}),
		});

		const tbl = table({
			name: "ExampleTable",
			entities: [Example],
			indexes: {
				all: { pk: ["entityType"] },
				good: { pk: ["status"], sk: ["price", "createdAt"] },
			},
		});

		expectTypeOf(tbl.indexes.all.pk).toEqualTypeOf<readonly ["entityType"]>();
		expectTypeOf(tbl.indexes.good.pk).toEqualTypeOf<readonly ["status"]>();
		expectTypeOf(tbl.indexes.good.sk).toEqualTypeOf<
			readonly ["price", "createdAt"]
		>();
	});

	it("rejects non-scalar index fields at the type level", () => {
		const Example = entity({
			name: "EXAMPLE",
			id: "exampleId",
			schema: z.object({
				exampleId: z.string(),
				tags: z.array(z.string()),
			}),
		});

		table({
			name: "BadExampleTable",
			entities: [Example],
			indexes: {
				// @ts-expect-error tags is not a valid scalar index field
				bad: { pk: ["tags"] },
			},
		});
	});
});
