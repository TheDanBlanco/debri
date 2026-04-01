import { describe, expect, it } from "vitest";
import { useMockedClient } from "./client-test-helpers.js";

describe("client query and collection", () => {
	const mocked = useMockedClient();

	it("should map returned items in collection builders", async () => {
		mocked.mockSend.mockResolvedValueOnce({
			Items: [
				{
					entityType: "LISTING",
					id: "1",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
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
				{ entityType: "UNKNOWN", id: "2" },
			],
			LastEvaluatedKey: { id: "1" },
		});

		const result = await mocked.client
			.index("browse", { zipCode: "12345", status: "ACTIVE" })
			.collection();

		expect(result.data.LISTING).toHaveLength(1);
		expect(result.cursor).toBeDefined();
	});

	it("should throw UnknownEntityError in parseItem if unknown entity is passed", async () => {
		mocked.mockSend.mockResolvedValueOnce({ Item: { id: "1" } });

		await expect(
			(
				mocked.client.get as (
					entityName: string,
					id: string,
				) => Promise<unknown>
			)("UNKNOWN_ENTITY", "1"),
		).rejects.toThrow("Unknown entity");
	});

	it("should handle options in collection builders", async () => {
		mocked.mockSend.mockResolvedValueOnce({ Items: [] });

		await mocked.client
			.index("browse", { zipCode: "12345", status: "ACTIVE" })
			.collection()
			.page({ limit: 10, cursor: "eyJpZCI6IjEifQ==" });

		const lastCall = mocked.mockSend.mock.calls[0][0].input;
		expect(lastCall.Limit).toBe(10);
		expect(lastCall.ExclusiveStartKey).toEqual({ id: "1" });
	});

	it("should accept index names in entity builders", async () => {
		mocked.mockSend.mockResolvedValueOnce({ Items: [] });

		await mocked.client
			.index("listing", { listingId: "lst-1" })
			.entity("LISTING");

		const lastCall = mocked.mockSend.mock.calls[0][0].input;
		expect(lastCall.IndexName).toBe("listingIndex");
	});

	it("should pass ScanIndexForward when desc is provided", async () => {
		mocked.mockSend.mockResolvedValueOnce({ Items: [] });

		await mocked.client
			.index("listing", { listingId: "lst-1" })
			.entity("LISTING")
			.desc();

		const lastCall = mocked.mockSend.mock.calls[0][0].input;
		expect(lastCall.ScanIndexForward).toBe(false);
	});

	it("should support thenable entity index builders", async () => {
		mocked.mockSend.mockResolvedValueOnce({ Items: [] });

		await mocked.client
			.index("listing", { listingId: "lst-1" })
			.entity("LISTING")
			.desc()
			.page({ cursor: "eyJpZCI6IjEifQ==", limit: 5 })
			.pick(["price"]);

		const lastCall = mocked.mockSend.mock.calls[0][0].input;
		expect(lastCall.IndexName).toBe("listingIndex");
		expect(lastCall.ScanIndexForward).toBe(false);
		expect(lastCall.Limit).toBe(5);
		expect(lastCall.ExclusiveStartKey).toEqual({ id: "1" });
		expect(lastCall.ProjectionExpression).toContain("#proj_price");
	});

	it("should support thenable collection index builders", async () => {
		mocked.mockSend.mockResolvedValueOnce({ Items: [] });

		await mocked.client
			.index("browse", { zipCode: "12345", status: "ACTIVE" })
			.collection()
			.filter({ price: { gte: 100 } })
			.asc()
			.limit(3);

		const lastCall = mocked.mockSend.mock.calls[0][0].input;
		expect(lastCall.IndexName).toBe("browseIndex");
		expect(lastCall.ScanIndexForward).toBe(true);
		expect(lastCall.Limit).toBe(3);
		expect(lastCall.FilterExpression).toContain("#f_price >=");
	});

	it("should include base fields when pick is given in entity builders", async () => {
		mocked.mockSend.mockResolvedValueOnce({
			Items: [
				{
					entityType: "LISTING",
					id: "1",
					createdAt: "2023-01-01T00:00:00.000Z",
					updatedAt: "2023-01-01T00:00:00.000Z",
					listingId: "lst-1",
					price: 100,
				},
			],
		});

		const result = await mocked.client
			.index("listing", { listingId: "lst-1" })
			.entity("LISTING")
			.pick(["price"]);

		expect(result.items[0]).toHaveProperty("price", 100);
		expect(result.items[0]).toHaveProperty("id", "1");
		expect(result.items[0]).toHaveProperty("entityType", "LISTING");
	});
});
