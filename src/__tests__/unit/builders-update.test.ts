import { describe, expect, it } from "vitest";
import { buildUpdateExpression } from "../../builders.js";
import { op } from "../../operations.js";

describe("buildUpdateExpression", () => {
	it("should throw if no fields to update", () => {
		expect(() => buildUpdateExpression({})).toThrow("No fields to update");
	});

	it("handles operations namespace", () => {
		const { expression, values, names } = buildUpdateExpression({
			views: op.add(1),
			tags: op.remove(),
			comments: op.append(["new comment"]),
			history: op.prepend(["old event"]),
			status: "ACTIVE",
		});

		expect(expression).toBe(
			"SET #upd_comments = list_append(if_not_exists(#upd_comments, :upd_emptyList), :upd_comments), #upd_history = list_append(:upd_history, if_not_exists(#upd_history, :upd_emptyList)), #upd_status = :upd_status, #upd_updatedAt = :upd_updatedAt ADD #upd_views :upd_views REMOVE #upd_tags",
		);
		expect(values).toEqual({
			":upd_views": 1,
			":upd_comments": ["new comment"],
			":upd_history": ["old event"],
			":upd_emptyList": [],
			":upd_status": "ACTIVE",
			":upd_updatedAt": expect.any(String),
		});
		expect(names).toEqual({
			"#upd_views": "views",
			"#upd_tags": "tags",
			"#upd_comments": "comments",
			"#upd_history": "history",
			"#upd_status": "status",
			"#upd_updatedAt": "updatedAt",
		});
	});
});
