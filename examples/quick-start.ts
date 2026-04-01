import {
	CreateTableCommand,
	DynamoDBClient,
	UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { entity, table } from "../src/index.js";

const Listing = entity({
	name: "LISTING",
	id: "listingId",
	schema: z.object({
		listingId: z.string(),
		address: z.string(),
		zipCode: z.string(),
		status: z.enum(["ACTIVE", "PENDING", "SOLD"]),
		price: z.number(),
		agentId: z.string(),
		expiresAt: z.string().optional(),
	}),
});

const Offer = entity({
	name: "OFFER",
	id: "offerId",
	schema: z.object({
		offerId: z.string(),
		listingId: z.string(),
		amount: z.number(),
		status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
		buyerName: z.string(),
	}),
});

const RealEstate = table({
	name: "ExampleQuickStart",
	entities: [Listing, Offer],
	ttl: "expiresAt",
	indexes: {
		listing: { pk: ["listingId"], sk: ["entityType", "id"] },
		browse: { pk: ["zipCode", "status"], sk: ["price"] },
	},
});

async function main() {
	const baseClient = new DynamoDBClient({
		region: "us-east-1",
		endpoint: process.env.AWS_ENDPOINT,
		credentials: { accessKeyId: "local", secretAccessKey: "local" },
	});

	await baseClient.send(new CreateTableCommand(RealEstate.tableSchema()));

	const ttlConfig = RealEstate.ttlConfig();
	if (ttlConfig) {
		await baseClient.send(new UpdateTimeToLiveCommand(ttlConfig));
	}

	const docClient = DynamoDBDocumentClient.from(baseClient, {
		marshallOptions: { removeUndefinedValues: true },
	});

	const db = RealEstate.connect({ client: docClient });

	await db.put("LISTING", {
		listingId: "lst-001",
		address: "123 Oak Street",
		zipCode: "90210",
		status: "ACTIVE",
		price: 425000,
		agentId: "agt-001",
	});

	const results = await db
		.index("browse", {
			zipCode: "90210",
			status: "ACTIVE",
			price: { lte: 500000 },
		})
		.entity("LISTING");

	console.log(results.items[0]?.price);
}

void main();
