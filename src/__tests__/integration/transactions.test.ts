import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, setupTable, TestTable, teardownTable } from "../setup.js";

const db = createDb();

beforeAll(async () => {
	await setupTable();
});

afterAll(async () => {
	await teardownTable();
});

describe("transactions", () => {
	it("should execute multiple operations atomically", async () => {
		const listing = await db.put("LISTING", {
			listingId: "lst-txn",
			address: "700 Transaction Terrace",
			city: "Test City",
			state: "CA",
			zipCode: "44444",
			price: 500000,
			beds: 3,
			baths: 2,
			sqft: 1800,
			propertyType: "SINGLE_FAMILY",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		await db.transactWrite([
			{
				type: "update",
				tableName: TestTable.name,
				key: { id: listing.id, entityType: "LISTING" },
				updates: { status: "PENDING" },
			},
			{
				type: "put",
				tableName: TestTable.name,
				item: {
					id: "txn-offer-id",
					entityType: "OFFER",
					entityId: "ofr-txn",
					listingId: "lst-txn",
					offerId: "ofr-txn",
					amount: 480000,
					financingType: "CONVENTIONAL",
					buyerName: "Transactor",
					status: "PENDING",
					expiresAt: "2026-05-01",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			},
		]);

		const updatedListing = await db.get("LISTING", listing.id);
		expect(updatedListing?.status).toBe("PENDING");

		const offer = await db.get("OFFER", "txn-offer-id");
		expect(offer?.buyerName).toBe("Transactor");
	});

	it("should reject transactions over 100 operations", async () => {
		const ops = Array.from({ length: 101 }, () => ({
			type: "put" as const,
			tableName: TestTable.name,
			item: { id: "x", entityType: "LISTING" },
		}));

		await expect(db.transactWrite(ops)).rejects.toThrow("up to 100 operations");
	});
	it("should execute transact delete and check operations", async () => {
		const listing1 = await db.put("LISTING", {
			listingId: "lst-txn-del1",
			address: "800 Transaction Delete 1",
			city: "Test City",
			state: "CA",
			zipCode: "44444",
			price: 500000,
			beds: 3,
			baths: 2,
			sqft: 1800,
			propertyType: "SINGLE_FAMILY",
			status: "ACTIVE",
			agentId: "agt-001",
		});
		const listing2 = await db.put("LISTING", {
			listingId: "lst-txn-del2",
			address: "800 Transaction Delete 2",
			city: "Test City",
			state: "CA",
			zipCode: "44444",
			price: 500000,
			beds: 3,
			baths: 2,
			sqft: 1800,
			propertyType: "SINGLE_FAMILY",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		await db.transactWrite([
			{
				type: "check",
				tableName: TestTable.name,
				key: { id: listing1.id, entityType: "LISTING" },
				condition: {
					expression: "attribute_exists(id)",
				},
			},
			{
				type: "delete",
				tableName: TestTable.name,
				key: { id: listing2.id, entityType: "LISTING" },
			},
		]);

		const deleted = await db.get("LISTING", listing2.id);
		expect(deleted).toBeUndefined();
	});

	it("should throw ConditionFailedError if transaction cancelled", async () => {
		await expect(
			db.transactWrite([
				{
					type: "check",
					tableName: TestTable.name,
					key: { id: "non-existent-id", entityType: "LISTING" },
					condition: {
						expression: "attribute_exists(id)",
					},
				},
			]),
		).rejects.toThrow("Transaction cancelled — one or more conditions failed");
	});

	it("should not apply partial writes when a transaction condition fails", async () => {
		const listing = await db.put("LISTING", {
			listingId: "lst-txn-rollback",
			address: "900 Rollback Rd",
			city: "Test City",
			state: "CA",
			zipCode: "45454",
			price: 510000,
			beds: 3,
			baths: 2,
			sqft: 1800,
			propertyType: "SINGLE_FAMILY",
			status: "ACTIVE",
			agentId: "agt-001",
		});

		await expect(
			db.transactWrite([
				db.tx.update("LISTING", listing.id, { status: "PENDING" }),
				db.tx.check("LISTING", listing.id, {
					expression: "price > :minPrice",
					values: { ":minPrice": 999999 },
				}),
			]),
		).rejects.toThrow("Transaction cancelled — one or more conditions failed");

		const after = await db.get("LISTING", listing.id);
		expect(after?.status).toBe("ACTIVE");
	});
});

it("should throw original error if transaction fails for non-condition reasons", async () => {
	await expect(
		db.transactWrite([
			{
				type: "check",
				tableName: "NON_EXISTENT_TABLE_NAME_123",
				key: { id: "non-existent-id", entityType: "LISTING" },
				condition: {
					expression: "attribute_exists(id)",
				},
			},
		]),
	).rejects.toThrow();
});
