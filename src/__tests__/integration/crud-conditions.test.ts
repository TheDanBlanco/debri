import { describe, expect, it } from "vitest";
import { useIntegrationDb } from "./test-db.js";

const db = useIntegrationDb();

describe("condition expressions", () => {
	it("should allow put with condition that passes", async () => {
		const result = await db.put(
			"LISTING",
			{
				listingId: "lst-cond-1",
				address: "500 Condition Ct",
				city: "Test City",
				state: "CA",
				zipCode: "77777",
				price: 250000,
				beds: 2,
				baths: 1,
				sqft: 1000,
				propertyType: "TOWNHOUSE",
				status: "ACTIVE",
				agentId: "agt-001",
			},
			{
				condition: {
					expression: "attribute_not_exists(id)",
				},
			},
		);

		expect(result.listingId).toBe("lst-cond-1");
	});

	it("should throw ConditionFailedError on update with failing condition", async () => {
		const created = await db.put("LISTING", {
			listingId: "lst-cond-fail",
			address: "600 Fail St",
			city: "Test City",
			state: "CA",
			zipCode: "77777",
			price: 100000,
			beds: 1,
			baths: 1,
			sqft: 500,
			propertyType: "CONDO",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		await expect(
			db.update(
				"LISTING",
				created.id,
				{ price: 150000 },
				{
					condition: {
						expression: "price > :minPrice",
						values: { ":minPrice": 999999 },
					},
				},
			),
		).rejects.toMatchObject({
			name: "ConditionFailedError",
			message:
				"Condition failed on update for LISTING#lst-cond-fail — item exists but the provided condition did not match",
		});
	});

	it("should support caller-provided condition attribute names", async () => {
		await db.put("LISTING", {
			listingId: "lst-cond-size",
			address: "700 Alias Ave",
			city: "Test City",
			state: "CA",
			zipCode: "77777",
			price: 325000,
			beds: 3,
			baths: 2,
			sqft: 1200,
			propertyType: "CONDO",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		await expect(
			db.delete("LISTING", "lst-cond-size", {
				condition: {
					expression: "#size = :sqft",
					values: { ":sqft": 1200 },
					names: { "#size": "sqft" },
				},
			}),
		).resolves.toBeUndefined();

		const deleted = await db.get("LISTING", "lst-cond-size");
		expect(deleted).toBeUndefined();
	});
});
