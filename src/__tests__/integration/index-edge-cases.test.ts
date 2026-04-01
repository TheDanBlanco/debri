import { describe, expect, it } from "vitest";
import { useIntegrationDb } from "./test-db.js";

const db = useIntegrationDb();

describe("index edge cases", () => {
	it("omits sparse items from a shared GSI when a key attribute is missing", async () => {
		await db.put("OFFER", {
			offerId: "ofr-sparse-1",
			listingId: "lst-sparse-1",
			amount: 450000,
			financingType: "CONVENTIONAL",
			buyerName: "Sparse Buyer",
			status: "ACTIVE",
			expiresAt: "2026-05-01",
		});

		const listingPartition = await db
			.index("listing", { listingId: "lst-sparse-1" })
			.collection();
		expect(
			listingPartition.data.OFFER.map(
				(item: { offerId: string }) => item.offerId,
			),
		).toContain("ofr-sparse-1");

		const browseResults = await db
			.index("browse", { zipCode: "94110", status: "ACTIVE" })
			.entity("LISTING");
		expect(browseResults.items).toEqual([]);
	});

	it("keeps sparse non-target entities out of typed shared-GSI queries", async () => {
		await db.put("OFFER", {
			offerId: "ofr-sparse-2",
			listingId: "lst-sparse-2",
			zipCode: "10001",
			amount: 500000,
			financingType: "CASH",
			buyerName: "Remove Buyer",
			status: "ACTIVE",
			expiresAt: "2026-05-02",
		});

		await db.put("LISTING", {
			listingId: "lst-sparse-2",
			address: "100 Sparse St",
			city: "New York",
			state: "NY",
			zipCode: "10001",
			price: 510000,
			beds: 2,
			baths: 2,
			sqft: 1200,
			propertyType: "CONDO",
			status: "ACTIVE",
			agentId: "agt-10001",
		});

		const results = await db
			.index("browse", { zipCode: "10001", status: "ACTIVE" })
			.entity("LISTING");

		expect(
			results.items.map((item: { listingId: string }) => item.listingId),
		).toContain("lst-sparse-2");
		for (const item of results.items) {
			expect(item.entityType).toBe("LISTING");
		}
	});

	it("handles beginsWith queries on string sort keys with entity scoping preserved", async () => {
		await db.put("LISTING", {
			listingId: "lst-agent-begins-1",
			address: "1 Agent Way",
			city: "Test City",
			state: "CA",
			zipCode: "12321",
			price: 300000,
			beds: 2,
			baths: 2,
			sqft: 1100,
			propertyType: "CONDO",
			status: "ACTIVE",
			agentId: "agt-prefix",
		});

		await db.put("AGENT", {
			agentId: "agt-prefix",
			listingId: "lst-agent-begins-1",
			name: "Prefix Agent",
			brokerage: "Prefix Realty",
			phone: "555-0100",
			email: "prefix@example.com",
			licenseNumber: "CA-PREFIX",
		});

		const result = await db
			.index("agent", {
				agentId: "agt-prefix",
				price: 300000,
				createdAt: { beginsWith: "20" },
			})
			.entity("LISTING");

		for (const item of result.items) {
			expect(item.entityType).toBe("LISTING");
			expect(item.agentId).toBe("agt-prefix");
		}
	});
});
