import { beforeAll, describe, expect, it } from "vitest";
import type { createDb } from "../setup.js";
import { seedFilterFixtures } from "./filter-fixtures.js";
import { useIntegrationDb } from "./test-db.js";

const db = useIntegrationDb();

beforeAll(async () => {
	await seedFilterFixtures(db as ReturnType<typeof createDb>);
});

describe("filter expressions advanced", () => {
	it("should support contains and beginsWith operators", async () => {
		await db.put("LISTING", {
			listingId: "f-4",
			price: 2400,
			status: "ACTIVE",
			propertyType: "CONDO",
			agentId: "agt-1",
			address: "4",
			city: "la",
			state: "ca",
			zipCode: "90001",
			beds: 2,
			baths: 2,
			sqft: 1600,
			description: "pool house",
		});

		const results = await db
			.index("browse", { zipCode: "90001", status: "ACTIVE" })
			.entity("LISTING")
			.filter({
				description: { contains: "pool" },
				address: { beginsWith: "4" },
			});

		expect(results.items).toHaveLength(1);
		expect(results.items[0]?.listingId).toBe("f-4");
	});

	it("should support NOT and AND composition", async () => {
		const results = await db
			.index("browse", { zipCode: "90001", status: "ACTIVE" })
			.entity("LISTING")
			.filter({
				AND: [{ beds: { gte: 2 } }, { baths: { gte: 2 } }],
				NOT: { propertyType: "SINGLE_FAMILY" },
			});

		expect(results.items).toHaveLength(1);
		expect(results.items[0]?.listingId).toBe("f-4");
	});
});
