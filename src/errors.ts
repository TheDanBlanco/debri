export class EntityNotFoundError extends Error {
	constructor(entityName: string, id: string) {
		super(`${entityName} with id "${id}" not found`);
		this.name = "EntityNotFoundError";
	}
}

export class ConditionFailedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConditionFailedError";
	}
}

export class UnknownEntityError extends Error {
	constructor(entityName: string, knownEntities: string[]) {
		super(
			`Unknown entity "${entityName}". ` +
				`Known entities: ${knownEntities.join(", ")}`,
		);
		this.name = "UnknownEntityError";
	}
}

export class IndexNotFoundError extends Error {
	constructor() {
		super(
			'Could not resolve index. Pass a registered index name, e.g. "listing"',
		);
		this.name = "IndexNotFoundError";
	}
}
