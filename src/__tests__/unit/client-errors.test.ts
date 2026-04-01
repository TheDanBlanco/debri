import { describe, expect, it } from "vitest";
import { IndexNotFoundError, UnknownEntityError } from "../../index.js";
import { createDb } from "../setup.js";

// Only need the client instance, no real DB connection needed to test these errors
const db = createDb();

describe("error handling", () => {
	it("should throw UnknownEntityError for invalid entity name", async () => {
		await expect(
			// Force the call with a bad name — cast through unknown to bypass type checking
			(db.get as (name: string, id: string) => Promise<unknown>)(
				"INVALID_ENTITY",
				"some-id",
			),
		).rejects.toThrow(UnknownEntityError);
	});

	it("should throw IndexNotFoundError for unregistered index", async () => {
		const badIndex = db.index as unknown as (
			indexName: string,
			params: object,
		) => { entity: (entityName: string) => PromiseLike<unknown> };

		await expect(
			badIndex("fakeIndex", { fake: "value" }).entity("LISTING"),
		).rejects.toThrow(IndexNotFoundError);
	});
});

describe("multi-key validation", () => {
	it("should reject queries skipping a sort key", async () => {
		await expect(
			db
				.index("agent", {
					agentId: "agt-001",
					createdAt: "2026-01-01", // Skipped price
					// biome-ignore lint/suspicious/noExplicitAny: Intentional bad type for testing
				} as any)
				.entity("LISTING"),
		).rejects.toThrow("Cannot skip sort key attributes");
	});

	it("should reject queries with range condition not at the end", async () => {
		await expect(
			db
				.index("agent", {
					agentId: "agt-001",
					price: { lte: 500000 },
					createdAt: "2026-01-01",
					// biome-ignore lint/suspicious/noExplicitAny: Intentional bad type for testing
				} as any)
				.entity("LISTING"),
		).rejects.toThrow(
			"Range conditions are only supported on the last provided sort key",
		);
	});

	it("should have a ts error if you order the sort keys wrong", async () => {
		await expect(
			db
				.index("agent", {
					agentId: "agt-001",
					createdAt: "2026-01-01",
					price: { lte: 500000 },
					// biome-ignore lint/suspicious/noExplicitAny: Intentional bad type for testing
				} as any)
				.entity("LISTING"),
		).rejects.toThrow();
	});
});
