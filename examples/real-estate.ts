import { z } from "zod";
import { entity, op, table } from "../src/index.js";

const Listing = entity({
	name: "LISTING",
	id: "listingId",
	schema: z.object({
		listingId: z.string(),
		address: z.string(),
		city: z.string(),
		state: z.string(),
		zipCode: z.string(),
		price: z.number(),
		status: z.enum(["ACTIVE", "PENDING", "SOLD"]),
		propertyType: z.enum(["CONDO", "SINGLE_FAMILY", "TOWNHOUSE"]),
		agentId: z.string(),
		showingNotes: z.array(z.string()).optional(),
	}),
});

const Agent = entity({
	name: "AGENT",
	id: "agentId",
	schema: z.object({
		agentId: z.string(),
		listingId: z.string(),
		name: z.string(),
		email: z.string(),
		licenseNumber: z.string(),
	}),
});

const Offer = entity({
	name: "OFFER",
	id: "offerId",
	schema: z.object({
		offerId: z.string(),
		listingId: z.string(),
		zipCode: z.string().optional(),
		amount: z.number(),
		status: z.enum(["ACTIVE", "PENDING", "ACCEPTED", "REJECTED"]),
		buyerName: z.string(),
		financingType: z.enum(["CONVENTIONAL", "FHA", "VA", "CASH"]),
		expiresAt: z.string(),
	}),
});

export const RealEstate = table({
	name: "ExampleRealEstate",
	entities: [Listing, Agent, Offer],
	indexes: {
		allListings: { pk: ["entityType"] },
		listing: { pk: ["listingId"], sk: ["entityType", "id"] },
		browse: { pk: ["zipCode", "status"], sk: ["price"] },
		agent: { pk: ["agentId"], sk: ["createdAt"] },
	},
});

export async function example(db: ReturnType<typeof RealEstate.connect>) {
	await db.put("LISTING", {
		listingId: "lst-200",
		address: "44 Sunset Ave",
		city: "Los Angeles",
		state: "CA",
		zipCode: "90001",
		price: 725000,
		status: "ACTIVE",
		propertyType: "SINGLE_FAMILY",
		agentId: "agt-200",
	});

	await db.put("AGENT", {
		agentId: "agt-200",
		listingId: "lst-200",
		name: "Sam Agent",
		email: "sam@example.com",
		licenseNumber: "CA-200",
	});

	await db.update("LISTING", "lst-200", {
		price: 715000,
		showingNotes: op.append(["Open house next Saturday"]),
	});

	const browse = await db
		.index("browse", {
			zipCode: "90001",
			status: "ACTIVE",
			price: { lte: 800000 },
		})
		.entity("LISTING");

	const allListings = await db.index("allListings", {}).entity("LISTING");

	const partition = await db
		.index("listing", { listingId: "lst-200" })
		.collection();

	return {
		allListingsCount: allListings.items.length,
		browseCount: browse.items.length,
		listingCount: partition.data.LISTING.length,
		agentCount: partition.data.AGENT.length,
		offerCount: partition.data.OFFER.length,
	};
}
