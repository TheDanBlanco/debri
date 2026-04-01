import { describe, expect, it } from "vitest";
import type { TransactOperation } from "../../index.js";
import { TestTable } from "../setup.js";
import { useMockedClient } from "./client-test-helpers.js";

describe("client transact operations", () => {
	const mocked = useMockedClient();

	it("should throw error if unknown operation type in transactWrite", async () => {
		const badOp = {
			type: "unknown_op",
			tableName: "MockTable",
			key: { id: "1" },
		} as unknown as Parameters<typeof mocked.client.transactWrite>[0][0];

		await expect(mocked.client.transactWrite([badOp])).rejects.toThrow(
			"Unknown operation type: unknown_op",
		);
	});

	it("should resolve instantly on empty transactWrite", async () => {
		await mocked.client.transactWrite([]);
		expect(mocked.mockSend).not.toHaveBeenCalled();
	});

	it("should only map transaction cancellation to ConditionFailedError for condition failures", async () => {
		const err = Object.assign(new Error("Transaction cancelled"), {
			name: "TransactionCanceledException",
			CancellationReasons: [
				{ Code: "ConditionalCheckFailed" },
				{ Code: "None" },
			],
		});
		mocked.mockSend.mockRejectedValueOnce(err);

		await expect(
			mocked.client.transactWrite([
				{
					type: "delete",
					tableName: TestTable.name,
					key: { id: "1", entityType: "LISTING" },
				},
			]),
		).rejects.toThrow("Transaction cancelled — one or more conditions failed");
	});

	it("should preserve non-condition transaction cancellation errors", async () => {
		const err = Object.assign(new Error("Provisioned throughput exceeded"), {
			name: "TransactionCanceledException",
			CancellationReasons: [{ Code: "ProvisionedThroughputExceeded" }],
		});
		mocked.mockSend.mockRejectedValueOnce(err);

		await expect(
			mocked.client.transactWrite([
				{
					type: "delete",
					tableName: TestTable.name,
					key: { id: "1", entityType: "LISTING" },
				},
			]),
		).rejects.toBe(err);
	});

	it("should throw if more than 100 operations in transactWrite", async () => {
		const ops = Array.from({ length: 101 }).map(() => ({
			type: "delete" as const,
			tableName: "MockTable",
			key: { id: "1" },
		}));

		await expect(
			mocked.client.transactWrite(
				ops as unknown as Parameters<typeof mocked.client.transactWrite>[0],
			),
		).rejects.toThrow("TransactWrite supports up to 100 operations, got 101");
	});

	describe("tx helpers", () => {
		it("should build a typed put operation", () => {
			const txOp = mocked.client.tx.put("LISTING", {
				listingId: "lst-tx",
				price: 100,
				status: "ACTIVE",
				propertyType: "CONDO",
				agentId: "agt-1",
				address: "123 tx st",
				city: "txville",
				state: "CA",
				zipCode: "12345",
				beds: 1,
				baths: 1,
				sqft: 100,
			});
			const op = txOp as Extract<TransactOperation, { type: "put" }>;

			expect(op.type).toBe("put");
			expect(op.tableName).toBe(TestTable.name);
			expect(op.item.id).toBe("lst-tx");
			expect(op.item.entityType).toBe("LISTING");
			expect(op.item.createdAt).toBeDefined();
		});

		it("should build a typed update operation", () => {
			const txOp = mocked.client.tx.update("LISTING", "lst-tx", { price: 200 });
			const op = txOp as Extract<TransactOperation, { type: "update" }>;

			expect(op.type).toBe("update");
			expect(op.tableName).toBe(TestTable.name);
			expect(op.key).toEqual({ id: "lst-tx", entityType: "LISTING" });
			expect(op.updates).toEqual({ price: 200 });
		});

		it("should build a typed delete operation", () => {
			const txOp = mocked.client.tx.delete("LISTING", "lst-tx");
			const op = txOp as Extract<TransactOperation, { type: "delete" }>;

			expect(op.type).toBe("delete");
			expect(op.key).toEqual({ id: "lst-tx", entityType: "LISTING" });
		});

		it("should build a typed check operation", () => {
			const txOp = mocked.client.tx.check("LISTING", "lst-tx", {
				expression: "attribute_exists(id)",
			});
			const op = txOp as Extract<TransactOperation, { type: "check" }>;

			expect(op.type).toBe("check");
			expect(op.condition.expression).toBe("attribute_exists(id)");
		});

		it("should validate put data in tx.put", () => {
			expect(() =>
				(
					mocked.client.tx.put as (
						entityName: string,
						item: Record<string, unknown>,
					) => TransactOperation
				)("LISTING", {
					listingId: "lst-tx",
					price: "not-a-number",
				}),
			).toThrow();
		});

		it("should work end-to-end with transactWrite", async () => {
			mocked.mockSend.mockResolvedValueOnce({});

			await mocked.client.transactWrite([
				mocked.client.tx.put("LISTING", {
					listingId: "lst-tx-e2e",
					price: 100,
					status: "ACTIVE",
					propertyType: "CONDO",
					agentId: "agt-1",
					address: "123 tx st",
					city: "txville",
					state: "CA",
					zipCode: "12345",
					beds: 1,
					baths: 1,
					sqft: 100,
				}),
				mocked.client.tx.delete("LISTING", "lst-old"),
			]);

			expect(mocked.mockSend).toHaveBeenCalledTimes(1);
		});
	});
});
