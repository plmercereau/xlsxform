export class PyXFormError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PyXFormError";
	}
}

export class ValidationError extends PyXFormError {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}
