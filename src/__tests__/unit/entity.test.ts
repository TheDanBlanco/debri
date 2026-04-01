import { describe, expect, it } from "vitest";
import { z } from "zod";
import { entity } from "../../entity.js";

describe("entity", () => {
	it("rejects optional natural ID fields at runtime", () => {
		expect(() =>
			entity({
				name: "BROKEN",
				id: "brokenId" as never,
				schema: z.object({
					brokenId: z.string().optional(),
				}),
			}),
		).toThrow('Entity BROKEN id field "brokenId" must be required');
	});
});
