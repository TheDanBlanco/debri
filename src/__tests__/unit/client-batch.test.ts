import { describe, expect, it } from "vitest";
import { TestTable } from "../setup.js";
import { useMockedClient } from "./client-test-helpers.js";

describe("client batch operations", () => {
	const mocked = useMockedClient();

	it("should handle UnprocessedItems retry logic in batchPut", async () => {
		mocked.mockSend.mockResolvedValueOnce({
			UnprocessedItems: {
				[TestTable.name]: [
					{
						PutRequest: {
							Item: {
								id: "1",
								entityType: "LISTING",
								listingId: "lst-1",
								price: 100,
								status: "ACTIVE",
								propertyType: "CONDO",
								agentId: "agt-1",
							},
						},
					},
				],
			},
		});
		mocked.mockSend.mockResolvedValueOnce({ UnprocessedItems: {} });

		await mocked.client.batchPut("LISTING", [
			{
				listingId: "lst-1",
				price: 100,
				status: "ACTIVE",
				propertyType: "CONDO",
				agentId: "agt-1",
				address: "123 mock st",
				city: "mockville",
				state: "CA",
				zipCode: "12345",
				beds: 1,
				baths: 1,
				sqft: 100,
			},
		]);

		expect(mocked.mockSend).toHaveBeenCalledTimes(2);
	});

	it("should throw if batchPut retries exhaust", async () => {
		mocked.mockSend.mockResolvedValue({
			UnprocessedItems: {
				[TestTable.name]: [
					{
						PutRequest: {
							Item: {
								id: "1",
								entityType: "LISTING",
								listingId: "lst-1",
								price: 100,
								status: "ACTIVE",
								propertyType: "CONDO",
								agentId: "agt-1",
							},
						},
					},
				],
			},
		});

		await expect(
			mocked.client.batchPut("LISTING", [
				{
					listingId: "lst-1",
					price: 100,
					status: "ACTIVE",
					propertyType: "CONDO",
					agentId: "agt-1",
					address: "123 mock st",
					city: "mockville",
					state: "CA",
					zipCode: "12345",
					beds: 1,
					baths: 1,
					sqft: 100,
				},
			]),
		).rejects.toThrow("Failed to process 1 items after 3 retries");
		expect(mocked.mockSend).toHaveBeenCalledTimes(4);
	});

	it("should handle UnprocessedItems retry logic in batchDelete", async () => {
		mocked.mockSend.mockResolvedValueOnce({
			UnprocessedItems: {
				[TestTable.name]: [
					{ DeleteRequest: { Key: { id: "1", entityType: "LISTING" } } },
				],
			},
		});
		mocked.mockSend.mockResolvedValueOnce({ UnprocessedItems: {} });

		await mocked.client.batchDelete("LISTING", ["1"]);

		expect(mocked.mockSend).toHaveBeenCalledTimes(2);
	});

	it("should throw if batchDelete retries exhaust", async () => {
		mocked.mockSend.mockResolvedValue({
			UnprocessedItems: {
				[TestTable.name]: [
					{ DeleteRequest: { Key: { id: "1", entityType: "LISTING" } } },
				],
			},
		});

		await expect(mocked.client.batchDelete("LISTING", ["1"])).rejects.toThrow(
			"Failed to process 1 items after 3 retries",
		);
		expect(mocked.mockSend).toHaveBeenCalledTimes(4);
	});

	it("should throw validation error in batchPut for invalid items", async () => {
		const items = [
			{
				listingId: "lst-1",
				price: "not-a-number",
				status: "ACTIVE",
				propertyType: "CONDO",
				agentId: "agt-1",
				address: "123 mock st",
				city: "mockville",
				state: "CA",
				zipCode: "12345",
				beds: 1,
				baths: 1,
				sqft: 100,
			},
		];

		await expect(
			(
				mocked.client.batchPut as (
					entityName: string,
					items: unknown[],
				) => Promise<unknown>
			)("LISTING", items),
		).rejects.toThrow();
		expect(mocked.mockSend).not.toHaveBeenCalled();
	});
});
