import { describe, expect, it } from "vitest";
import { useIntegrationDb } from "./test-db.js";

const db = useIntegrationDb();

describe("pagination", () => {
	it("should paginate query results with limit and cursor", async () => {
		for (let i = 1; i <= 5; i++) {
			await db.put("LISTING", {
				listingId: `lst-page-${i}`,
				address: `${i}00 Page St`,
				city: "Pageville",
				state: "CA",
				zipCode: "99999",
				price: i * 100000,
				beds: i,
				baths: 1,
				sqft: 1000,
				propertyType: "CONDO",
				status: "ACTIVE",
				agentId: "agt-page",
			});
		}

		const page1 = await db
			.index("browse", { zipCode: "99999", status: "ACTIVE" })
			.entity("LISTING")
			.limit(2);

		expect(page1.items.length).toBe(2);
		expect(page1.cursor).toBeDefined();

		const page2 = await db
			.index("browse", { zipCode: "99999", status: "ACTIVE" })
			.entity("LISTING")
			.page({ limit: 2, cursor: page1.cursor });

		expect(page2.items.length).toBe(2);
		expect(page2.cursor).toBeDefined();

		const page1Ids = page1.items.map(
			(item: { listingId?: string }) => item.listingId,
		);
		const page2Ids = page2.items.map(
			(item: { listingId?: string }) => item.listingId,
		);
		for (const id of page1Ids) {
			expect(page2Ids).not.toContain(id);
		}
	});

	it("should paginate with the index builder api", async () => {
		const page1 = await db
			.index("browse", { zipCode: "99999", status: "ACTIVE" })
			.entity("LISTING")
			.desc()
			.limit(2);

		expect(page1.items.length).toBe(2);
		expect(page1.cursor).toBeDefined();

		const page2 = await db
			.index("browse", { zipCode: "99999", status: "ACTIVE" })
			.entity("LISTING")
			.page({ limit: 2, cursor: page1.cursor })
			.desc();

		expect(page2.items.length).toBe(2);
	});
});

describe("projections", () => {
	it("should only return picked fields plus base fields", async () => {
		await db.put("LISTING", {
			listingId: "lst-proj",
			address: "400 Projection Way",
			city: "Test City",
			state: "CA",
			zipCode: "88888",
			price: 350000,
			beds: 3,
			baths: 2,
			sqft: 1500,
			propertyType: "SINGLE_FAMILY",
			status: "ACTIVE",
			agentId: "agt-proj",
			description: "A lovely home for projections testing.",
		});

		const result = await db
			.index("browse", { zipCode: "88888", status: "ACTIVE" })
			.entity("LISTING")
			.pick(["listingId", "price", "address"]);

		expect(result.items.length).toBe(1);
		const item = result.items[0];
		expect(item?.listingId).toBe("lst-proj");
		expect(item?.price).toBe(350000);
		expect(item?.address).toBe("400 Projection Way");
		expect(item?.id).toBe("lst-proj");
		expect(item?.entityType).toBe("LISTING");
		expect(item?.createdAt).toBeDefined();
	});

	it("should project fields with the index builder api", async () => {
		const result = await db
			.index("browse", { zipCode: "88888", status: "ACTIVE" })
			.entity("LISTING")
			.pick(["listingId", "price"]);

		expect(result.items.length).toBeGreaterThanOrEqual(1);
		expect(result.items[0]?.listingId).toBeDefined();
		expect(result.items[0]?.price).toBeDefined();
		expect(result.items[0]?.id).toBeDefined();
	});
});
