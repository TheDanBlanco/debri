import { describe, expect, it } from "vitest";
import { useIntegrationDb } from "./test-db.js";

const db = useIntegrationDb();

describe("collection", () => {
	it("should return all entity types for a listing in one query", async () => {
		await db.put("AGENT", {
			agentId: "agt-001",
			listingId: "lst-001",
			name: "Jane Smith",
			brokerage: "RE/MAX",
			phone: "310-555-0101",
			email: "jane@remax.com",
			licenseNumber: "CA-123",
		});

		const result = await db
			.index("listing", { listingId: "lst-001" })
			.collection();

		expect(result.data.LISTING.length).toBeGreaterThanOrEqual(0);
		expect(result.data.AGENT.length).toBeGreaterThanOrEqual(1);
		expect(result.data.AGENT[0]?.brokerage).toBeDefined();
	});

	it("should return empty arrays for entity types with no items", async () => {
		const result = await db
			.index("listing", { listingId: "lst-no-data" })
			.collection();

		expect(result.data.LISTING).toEqual([]);
		expect(result.data.AGENT).toEqual([]);
		expect(result.data.OFFER).toEqual([]);
		expect(result.cursor).toBeUndefined();
	});

	it("should support collection reads through the index builder api", async () => {
		const result = await db
			.index("listing", { listingId: "lst-001" })
			.collection()
			.desc();

		expect(result.data.LISTING.length).toBeGreaterThanOrEqual(0);
		expect(result.data.AGENT.length).toBeGreaterThanOrEqual(1);
	});
});

describe("query", () => {
	it("should support PK-only indexes with an empty params object", async () => {
		await db.put("LISTING", {
			listingId: "lst-all-001",
			address: "1 All Listings Way",
			city: "Los Angeles",
			state: "CA",
			zipCode: "90010",
			price: 600000,
			beds: 2,
			baths: 2,
			sqft: 1200,
			propertyType: "CONDO",
			status: "ACTIVE",
			agentId: "agt-all-001",
		});

		const result = await db.index("allListings", {}).entity("LISTING");

		expect(
			result.items.map((item: { listingId: string }) => item.listingId),
		).toContain("lst-all-001");
		for (const item of result.items) {
			expect(item.entityType).toBe("LISTING");
		}
	});

	it("should query a specific entity type from a collection index", async () => {
		await db.put("OFFER", {
			offerId: "ofr-q-001",
			listingId: "lst-001",
			amount: 410000,
			financingType: "CONVENTIONAL",
			buyerName: "John Doe",
			status: "PENDING",
			expiresAt: "2026-04-05",
			contingencies: ["inspection", "appraisal"],
		});

		const result = await db
			.index("listing", { listingId: "lst-001" })
			.entity("OFFER");

		expect(result.items.length).toBeGreaterThanOrEqual(1);
		expect(result.items[0]?.amount).toBe(410000);
		expect(result.items[0]?.buyerName).toBe("John Doe");
	});

	it("should query browse index with multi-attribute PK", async () => {
		await db.put("OFFER", {
			offerId: "ofr-browse-noise",
			listingId: "lst-browse-noise",
			agentId: "agt-noise",
			zipCode: "90210",
			amount: 425000,
			financingType: "CONVENTIONAL",
			buyerName: "Noise Buyer",
			status: "ACTIVE",
			expiresAt: "2026-04-05",
		});
		await db.put("LISTING", {
			listingId: "lst-browse",
			address: "123 Oak Street",
			city: "Beverly Hills",
			state: "CA",
			zipCode: "90210",
			price: 425000,
			beds: 3,
			baths: 2,
			sqft: 1800,
			propertyType: "SINGLE_FAMILY",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		const result = await db
			.index("browse", { zipCode: "90210", status: "ACTIVE" })
			.entity("LISTING");

		expect(result.items.length).toBeGreaterThanOrEqual(1);
		for (const item of result.items) {
			expect(item.entityType).toBe("LISTING");
			expect(item.zipCode).toBe("90210");
			expect(item.status).toBe("ACTIVE");
		}
	});

	it("should support range conditions on sort key", async () => {
		await db.put("LISTING", {
			listingId: "lst-expensive",
			address: "999 Pricey Blvd",
			city: "Beverly Hills",
			state: "CA",
			zipCode: "90210",
			price: 900000,
			beds: 5,
			baths: 4,
			sqft: 4000,
			propertyType: "SINGLE_FAMILY",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		const cheap = await db
			.index("browse", {
				zipCode: "90210",
				status: "ACTIVE",
				price: { lte: 500000 },
			})
			.entity("LISTING");

		const all = await db
			.index("browse", { zipCode: "90210", status: "ACTIVE" })
			.entity("LISTING");

		expect(cheap.items.length).toBeLessThan(all.items.length);
		for (const item of cheap.items) {
			expect(item.price).toBeLessThanOrEqual(500000);
		}
	});

	it("should return empty array when no items match", async () => {
		const result = await db
			.index("browse", { zipCode: "00000", status: "ACTIVE" })
			.entity("LISTING");

		expect(result.items).toEqual([]);
		expect(result.cursor).toBeUndefined();
	});

	it("should support entity reads through the index builder api", async () => {
		const result = await db
			.index("browse", { zipCode: "90210", status: "ACTIVE" })
			.entity("LISTING")
			.filter({ propertyType: "SINGLE_FAMILY" })
			.asc();

		expect(result.items.length).toBeGreaterThanOrEqual(1);
		for (const item of result.items) {
			expect(item.entityType).toBe("LISTING");
		}
	});
});
