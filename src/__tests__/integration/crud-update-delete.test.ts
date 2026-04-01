import { describe, expect, it } from "vitest";
import { EntityNotFoundError } from "../../index.js";
import { useIntegrationDb } from "./test-db.js";

const db = useIntegrationDb();

describe("update", () => {
	it("should update specific fields and return full item", async () => {
		const created = await db.put("LISTING", {
			listingId: "lst-update",
			address: "100 Update Ave",
			city: "Test City",
			state: "CA",
			zipCode: "90210",
			price: 500000,
			beds: 4,
			baths: 3,
			sqft: 2000,
			propertyType: "CONDO",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		const updated = await db.update("LISTING", created.id, {
			price: 475000,
			status: "PENDING",
		});

		expect(updated.price).toBe(475000);
		expect(updated.status).toBe("PENDING");
		expect(updated.address).toBe("100 Update Ave");
		expect(updated.beds).toBe(4);
		expect(updated.updatedAt).toBeDefined();
		expect(updated.updatedAt).not.toBe(created.updatedAt);
	});

	it("should throw on empty updates", async () => {
		const created = await db.put("LISTING", {
			listingId: "lst-empty-update",
			address: "200 Empty St",
			city: "Test City",
			state: "CA",
			zipCode: "90210",
			price: 300000,
			beds: 2,
			baths: 1,
			sqft: 900,
			propertyType: "TOWNHOUSE",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		await expect(db.update("LISTING", created.id, {})).rejects.toThrow(
			"No fields to update",
		);
	});

	it("should throw EntityNotFoundError when updating a missing item", async () => {
		await expect(
			db.update("LISTING", "missing-listing", { price: 123456 }),
		).rejects.toThrow(EntityNotFoundError);
	});
});

describe("delete", () => {
	it("should delete an item", async () => {
		const created = await db.put("LISTING", {
			listingId: "lst-delete",
			address: "300 Delete Dr",
			city: "Test City",
			state: "CA",
			zipCode: "90210",
			price: 200000,
			beds: 1,
			baths: 1,
			sqft: 600,
			propertyType: "CONDO",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		await db.delete("LISTING", created.id);
		const got = await db.get("LISTING", created.id);
		expect(got).toBeUndefined();
	});

	it("should not throw when deleting nonexistent item", async () => {
		await expect(
			db.delete("LISTING", "nonexistent-uuid"),
		).resolves.toBeUndefined();
	});
});
