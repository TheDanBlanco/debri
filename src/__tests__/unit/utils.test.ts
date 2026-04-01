import { describe, expect, it } from "vitest";
import { whereDefined } from "../../utils.js";

describe("whereDefined", () => {
	it("omits keys with undefined values", () => {
		expect(
			whereDefined({
				cursor: undefined,
				limit: 10,
				userId: "usr-1",
			}),
		).toEqual({
			limit: 10,
			userId: "usr-1",
		});
	});

	it("preserves null values intentionally", () => {
		expect(
			whereDefined({
				banned: null,
				userId: undefined,
			}),
		).toEqual({
			banned: null,
		});
	});
});
