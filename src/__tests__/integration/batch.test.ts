import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, setupTable, teardownTable } from "../setup.js";

const db = createDb();

beforeAll(async () => {
	await setupTable();
});

afterAll(async () => {
	await teardownTable();
});

describe("batch operations", () => {
	it("should batch put multiple items", async () => {
		const items = Array.from({ length: 30 }, (_, i) => ({
			listingId: `lst-batch-${i}`,
			address: `${i} Batch Blvd`,
			city: "Batchville",
			state: "CA",
			zipCode: "66666",
			price: (i + 1) * 10000,
			beds: 2,
			baths: 1,
			sqft: 800,
			propertyType: "CONDO" as const,
			status: "ACTIVE" as const,
			agentId: "agt-batch",
		}));

		const results = await db.batchPut("LISTING", items);
		expect(results.length).toBe(30);

		const got = await db.get("LISTING", results[0].id);
		expect(got?.listingId).toBe("lst-batch-0");

		const got29 = await db.get("LISTING", results[29].id);
		expect(got29?.listingId).toBe("lst-batch-29");
	});

	it("should batch delete multiple items", async () => {
		const items = await db.batchPut("LISTING", [
			{
				listingId: "lst-bdel-1",
				address: "1 Delete",
				city: "X",
				state: "CA",
				zipCode: "55555",
				price: 100000,
				beds: 1,
				baths: 1,
				sqft: 500,
				propertyType: "CONDO",
				status: "ACTIVE",
				agentId: "agt-001",
			},
			{
				listingId: "lst-bdel-2",
				address: "2 Delete",
				city: "X",
				state: "CA",
				zipCode: "55555",
				price: 200000,
				beds: 2,
				baths: 1,
				sqft: 700,
				propertyType: "CONDO",
				status: "ACTIVE",
				agentId: "agt-001",
			},
		]);

		await db.batchDelete(
			"LISTING",
			items.map((i: { id: string }) => i.id),
		);

		const got1 = await db.get("LISTING", items[0].id);
		const got2 = await db.get("LISTING", items[1].id);
		expect(got1).toBeUndefined();
		expect(got2).toBeUndefined();
	});
});
