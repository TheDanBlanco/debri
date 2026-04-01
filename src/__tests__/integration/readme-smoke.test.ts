import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { op, whereDefined } from "../../index.js";
import { createDb, setupTable, teardownTable } from "../setup.js";

const db = createDb();

beforeAll(async () => {
	await setupTable();
});

afterAll(async () => {
	await teardownTable();
});

describe("README smoke", () => {
	it("supports the documented put, query, projection, condition, and op flows", async () => {
		await db.put("LISTING", {
			listingId: "lst-readme-1",
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
			description: "Original description",
		});

		const page = await db
			.index("browse", {
				zipCode: "90210",
				status: "ACTIVE",
				price: { lte: 500000 },
			})
			.entity("LISTING")
			.page(whereDefined({ cursor: undefined, limit: 5 }))
			.filter(whereDefined({ agentId: "agt-001", description: undefined }))
			.pick(["listingId", "price"]);

		expect(page.items[0]?.listingId).toBe("lst-readme-1");
		expect(page.items[0]?.price).toBe(425000);
		expect(page.items[0]?.id).toBe("lst-readme-1");

		const updated = await db.update("LISTING", "lst-readme-1", {
			description: op.remove(),
			price: op.add(1000),
		});

		expect(updated.price).toBe(426000);
		expect(updated.description).toBeUndefined();

		await expect(
			db.delete("LISTING", "lst-readme-1", {
				condition: {
					expression: "#size = :sqft",
					names: { "#size": "sqft" },
					values: { ":sqft": 1800 },
				},
			}),
		).resolves.toBeUndefined();

		const deleted = await db.get("LISTING", "lst-readme-1");
		expect(deleted).toBeUndefined();
	});
});
