import { describe, expectTypeOf, it } from "vitest";
import type { op } from "../../index.js";
import type { UpdateInput } from "../../types.js";
import type { Offer } from "../setup.js";

type OfferUpdates = UpdateInput<[typeof Offer], "OFFER">;

describe("UpdateInput Types", () => {
	it("allows normal sets", () => {
		expectTypeOf<{ amount: number }>().toExtend<OfferUpdates>();
		expectTypeOf<{ buyerName: string }>().toExtend<OfferUpdates>();
	});

	it("restricts op.add to numbers", () => {
		expectTypeOf<{
			amount: ReturnType<typeof op.add>;
		}>().toExtend<OfferUpdates>();
		expectTypeOf<{
			buyerName: ReturnType<typeof op.add>;
		}>().not.toExtend<OfferUpdates>();
	});

	it("restricts op.append to arrays", () => {
		expectTypeOf<{
			contingencies: ReturnType<typeof op.append<string>>;
		}>().toExtend<OfferUpdates>();
		expectTypeOf<{
			amount: ReturnType<typeof op.append<number>>;
		}>().not.toExtend<OfferUpdates>();
	});

	it("restricts op.remove to optional fields", () => {
		expectTypeOf<{
			contingencies: ReturnType<typeof op.remove>;
		}>().toExtend<OfferUpdates>();
		expectTypeOf<{
			amount: ReturnType<typeof op.remove>;
		}>().not.toExtend<OfferUpdates>();
	});
});
