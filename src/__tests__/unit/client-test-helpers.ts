import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeEach, vi } from "vitest";
import { TestTable } from "../setup.js";

export function useMockedClient() {
	let mockSend: ReturnType<typeof vi.fn>;
	let client: ReturnType<typeof TestTable.connect>;

	beforeEach(() => {
		mockSend = vi.fn();
		const docClient = { send: mockSend } as unknown as DynamoDBDocumentClient;
		client = TestTable.connect({ client: docClient });
	});

	return {
		get mockSend() {
			return mockSend;
		},
		get client() {
			return client;
		},
	};
}
