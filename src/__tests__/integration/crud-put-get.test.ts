import { describe, expect, it } from "vitest";
import { useIntegrationDb } from "./test-db.js";

const db = useIntegrationDb();

describe("put + get", () => {
	it("should put and get a listing", async () => {
		const result = await db.put("LISTING", {
			listingId: "lst-001",
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

		expect(result.id).toBe("lst-001");
		expect(result.entityType).toBe("LISTING");
		expect(result.address).toBe("123 Oak Street");
		expect(result.price).toBe(425000);
		expect(result.createdAt).toBeDefined();

		const got = await db.get("LISTING", result.id);
		expect(got).toBeDefined();
		expect(got?.address).toBe("123 Oak Street");
		expect(got?.price).toBe(425000);
	});

	it("should put and get an offer", async () => {
		const result = await db.put("OFFER", {
			offerId: "ofr-001",
			listingId: "lst-001",
			amount: 410000,
			financingType: "CONVENTIONAL",
			buyerName: "John Doe",
			status: "PENDING",
			expiresAt: "2026-04-05",
			contingencies: ["inspection", "appraisal"],
		});

		expect(result.id).toBe("ofr-001");
		expect(result.entityType).toBe("OFFER");
		expect(result.amount).toBe(410000);

		const got = await db.get("OFFER", result.id);
		expect(got?.buyerName).toBe("John Doe");
		expect(got?.contingencies).toEqual(["inspection", "appraisal"]);
	});

	it("should return undefined for nonexistent item", async () => {
		const got = await db.get("LISTING", "nonexistent-uuid");
		expect(got).toBeUndefined();
	});
});
