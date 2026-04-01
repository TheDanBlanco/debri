import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { op } from "../../index.js";
import { createDb, setupTable, teardownTable } from "../setup.js";

const db = createDb();

beforeAll(async () => {
	await setupTable();
});

afterAll(async () => {
	await teardownTable();
});

describe("Advanced Update Expressions", () => {
	it("should add a number using op.add", async () => {
		const offer = await db.put("OFFER", {
			offerId: "off-add",
			listingId: "lst-1",
			amount: 100000,
			financingType: "CASH",
			buyerName: "John Add",
			status: "PENDING",
			expiresAt: "2024-01-01T00:00:00Z",
		});

		const updated = await db.update("OFFER", offer.id, {
			amount: op.add(50000),
		});

		expect(updated.amount).toBe(150000);
	});

	it("should append and prepend to arrays", async () => {
		const offer = await db.put("OFFER", {
			offerId: "off-arr",
			listingId: "lst-1",
			amount: 100000,
			financingType: "CASH",
			buyerName: "John Arr",
			status: "PENDING",
			expiresAt: "2024-01-01T00:00:00Z",
			contingencies: ["inspection"],
		});

		// Append
		const appended = await db.update("OFFER", offer.id, {
			contingencies: op.append(["appraisal"]),
		});
		expect(appended.contingencies).toEqual(["inspection", "appraisal"]);

		// Prepend
		const prepended = await db.update("OFFER", offer.id, {
			contingencies: op.prepend(["financing"]),
		});
		expect(prepended.contingencies).toEqual([
			"financing",
			"inspection",
			"appraisal",
		]);
	});

	it("should handle list append when list doesnt exist yet", async () => {
		const offer = await db.put("OFFER", {
			offerId: "off-arr-empty",
			listingId: "lst-1",
			amount: 100000,
			financingType: "CASH",
			buyerName: "John ArrEmpty",
			status: "PENDING",
			expiresAt: "2024-01-01T00:00:00Z",
			// no contingencies
		});

		const appended = await db.update("OFFER", offer.id, {
			contingencies: op.append(["appraisal"]),
		});
		expect(appended.contingencies).toEqual(["appraisal"]);
	});

	it("should remove an optional attribute", async () => {
		const offer = await db.put("OFFER", {
			offerId: "off-rm",
			listingId: "lst-1",
			amount: 100000,
			financingType: "CASH",
			buyerName: "John Rm",
			status: "PENDING",
			expiresAt: "2024-01-01T00:00:00Z",
			contingencies: ["inspection"],
		});

		const removed = await db.update("OFFER", offer.id, {
			contingencies: op.remove(),
		});

		expect(removed.contingencies).toBeUndefined();

		// Verify it was actually removed from DB
		const fetched = await db.get("OFFER", offer.id);
		expect(fetched?.contingencies).toBeUndefined();
	});
});
