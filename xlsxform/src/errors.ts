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

export class ODKValidateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ODKValidateError";
	}
}

interface ErrorDetail {
	name: string;
	msg: string;
}

function makeDetail(
	name: string,
	msg: string,
): ErrorDetail & {
	value: string;
	format: (kwargs: Record<string, string>) => string;
} {
	return {
		name,
		msg,
		get value() {
			return msg;
		},
		format(kwargs: Record<string, string>) {
			let result = msg;
			for (const [k, v] of Object.entries(kwargs)) {
				result = result.replace(`{${k}}`, v);
			}
			return result;
		},
	};
}

export const ErrorCode = {
	HEADER_004: makeDetail(
		"Headers - invalid choices header",
		"[row : 1] On the 'choices' sheet, the '{column}' value is invalid. " +
			"Column headers must not be empty and must not contain spaces. " +
			"Learn more: https://xlsform.org/en/#setting-up-your-worksheets",
	),
	SURVEY_004: makeDetail(
		"Survey sheet - parameters parsing failed",
		"[row : {row}] On the 'survey' sheet, the 'parameters' value is invalid. " +
			"Parameters must be in the form of 'key1=value1 key2=value2.",
	),
	SURVEY_005: makeDetail(
		"Survey sheet - parameters unknown key",
		"[row : {row}] On the 'survey' sheet, the 'parameters' value is invalid. " +
			"The accepted parameter keys for this question type are '{accepted}'. " +
			"The following are invalid parameter key(s): '{rejected}'.",
	),
} as const;
