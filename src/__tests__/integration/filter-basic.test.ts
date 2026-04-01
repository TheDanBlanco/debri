import { beforeAll, describe, expect, it } from "vitest";
import type { createDb } from "../setup.js";
import { seedFilterFixtures } from "./filter-fixtures.js";
import { useIntegrationDb } from "./test-db.js";

const db = useIntegrationDb();

beforeAll(async () => {
	await seedFilterFixtures(db as ReturnType<typeof createDb>);
});

describe("filter expressions basics", () => {
	it("should filter query results correctly", async () => {
		const results = await db
			.index("browse", { zipCode: "90001", status: "ACTIVE" })
			.entity("LISTING")
			.filter({ beds: { gte: 2 }, propertyType: "SINGLE_FAMILY" });

		expect(results.items).toHaveLength(1);
		expect(results.items[0]?.listingId).toBe("f-2");
	});

	it("should work with OR operators in filter", async () => {
		const results = await db
			.index("browse", { zipCode: "90001", status: "ACTIVE" })
			.entity("LISTING")
			.filter({ OR: [{ sqft: { lt: 1500 } }, { sqft: { gt: 2500 } }] });

		expect(results.items).toHaveLength(1);
		expect(results.items[0]?.listingId).toBe("f-1");
	});

	it("should filter collection results correctly", async () => {
		const results = await db
			.index("browse", { zipCode: "90001", status: "ACTIVE" })
			.collection()
			.filter({ sqft: { gte: 2000 } });

		expect(results.data.LISTING).toHaveLength(1);
		expect(results.data.LISTING[0]?.listingId).toBe("f-2");
	});

	it("should support between and in operators", async () => {
		const results = await db
			.index("listing", { listingId: "f-2" })
			.entity("LISTING")
			.filter({
				sqft: { between: [1500, 2500] },
				propertyType: { in: ["SINGLE_FAMILY", "MULTI_FAMILY"] },
			});

		expect(results.items).toHaveLength(1);
		expect(results.items[0]?.listingId).toBe("f-2");
	});

	it("should support exists false for optional fields", async () => {
		const results = await db
			.index("browse", { zipCode: "90001", status: "ACTIVE" })
			.entity("LISTING")
			.filter({ description: { exists: false } });

		expect(results.items).toHaveLength(2);
		expect(
			results.items.map((item: { listingId: string }) => item.listingId).sort(),
		).toEqual(["f-1", "f-2"]);
	});

	it("should throw a clear error for undefined filter branches", async () => {
		const minBeds: number | undefined = undefined;
		const searchTerm: string | undefined = undefined;

		await expect(
			db
				.index("browse", { zipCode: "90001", status: "ACTIVE" })
				.entity("LISTING")
				.filter({
					beds: { gte: minBeds } as unknown as { gte: number },
					description: { contains: searchTerm } as unknown as {
						contains: string;
					},
					propertyType: "SINGLE_FAMILY",
				}),
		).rejects.toThrow(
			'Invalid filter at "filter.beds.gte": received undefined. Omit the field instead.',
		);
	});
});
