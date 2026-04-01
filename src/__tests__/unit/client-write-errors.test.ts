import { describe, expect, it } from "vitest";
import { EntityNotFoundError } from "../../index.js";
import { useMockedClient } from "./client-test-helpers.js";

describe("client write errors", () => {
	const mocked = useMockedClient();

	it("should throw EntityNotFoundError if update returns no Attributes", async () => {
		mocked.mockSend.mockResolvedValueOnce({ Attributes: undefined });

		await expect(
			mocked.client.update("LISTING", "some-id", { price: 100 }),
		).rejects.toThrow(EntityNotFoundError);
	});

	it("should throw non-conditional errors in put", async () => {
		mocked.mockSend.mockRejectedValueOnce(new Error("Generic DB Error"));

		await expect(
			mocked.client.put("LISTING", {
				listingId: "lst-err",
				price: 100,
				status: "ACTIVE",
				propertyType: "CONDO",
				agentId: "agt-1",
				address: "123 err st",
				city: "errville",
				state: "CA",
				zipCode: "12345",
				beds: 1,
				baths: 1,
				sqft: 100,
			}),
		).rejects.toThrow("Generic DB Error");
	});

	it("should throw non-conditional errors in delete", async () => {
		mocked.mockSend.mockRejectedValueOnce(new Error("Generic DB Error"));

		await expect(mocked.client.delete("LISTING", "some-id")).rejects.toThrow(
			"Generic DB Error",
		);
	});
});
