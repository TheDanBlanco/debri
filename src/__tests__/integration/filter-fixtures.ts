import type { createDb } from "../setup.js";

export async function seedFilterFixtures(db: ReturnType<typeof createDb>) {
	await db.batchPut("LISTING", [
		{
			listingId: "f-1",
			price: 1000,
			status: "ACTIVE",
			propertyType: "CONDO",
			agentId: "agt-1",
			address: "1",
			city: "la",
			state: "ca",
			zipCode: "90001",
			beds: 1,
			baths: 1,
			sqft: 1000,
		},
		{
			listingId: "f-2",
			price: 2000,
			status: "ACTIVE",
			propertyType: "SINGLE_FAMILY",
			agentId: "agt-1",
			address: "2",
			city: "la",
			state: "ca",
			zipCode: "90001",
			beds: 3,
			baths: 2,
			sqft: 2000,
		},
		{
			listingId: "f-3",
			price: 3000,
			status: "SOLD",
			propertyType: "SINGLE_FAMILY",
			agentId: "agt-1",
			address: "3",
			city: "la",
			state: "ca",
			zipCode: "90001",
			beds: 4,
			baths: 3,
			sqft: 3000,
		},
	]);
}
