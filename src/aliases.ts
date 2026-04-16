import * as constants from "./constants.js";

export const control: Record<string, string> = {
	group: constants.GROUP,
	lgroup: constants.REPEAT,
	repeat: constants.REPEAT,
	loop: constants.LOOP,
	"looped group": constants.REPEAT,
};

export const selectFromFile: Record<string, string> = {
	select_one_from_file: constants.SELECT_ONE,
	select_multiple_from_file: constants.SELECT_ALL_THAT_APPLY,
	"select one from file": constants.SELECT_ONE,
	"select multiple from file": constants.SELECT_ALL_THAT_APPLY,
};

export const select: Record<string, string> = {
	"add select one prompt using": constants.SELECT_ONE,
	"add select multiple prompt using": constants.SELECT_ALL_THAT_APPLY,
	"select all that apply from": constants.SELECT_ALL_THAT_APPLY,
	"select one from": constants.SELECT_ONE,
	select1: constants.SELECT_ONE,
	select_one: constants.SELECT_ONE,
	"select one": constants.SELECT_ONE,
	select_multiple: constants.SELECT_ALL_THAT_APPLY,
	"select all that apply": constants.SELECT_ALL_THAT_APPLY,
	select_one_external: constants.SELECT_ONE_EXTERNAL,
	...selectFromFile,
	rank: constants.RANK,
};

export const cascading: Record<string, string> = {
	"cascading select": constants.CASCADING_SELECT,
	cascading_select: constants.CASCADING_SELECT,
};

export const settingsHeader: Record<string, string> = {
	form_title: constants.TITLE,
	set_form_title: constants.TITLE,
	form_id: constants.ID_STRING,
	set_form_id: constants.ID_STRING,
	prefix: constants.COMPACT_PREFIX,
};

export const surveyHeader: Record<string, string | [string, string]> = {
	sms_field: constants.SMS_FIELD,
	sms_option: constants.SMS_OPTION,
	sms_separator: constants.SMS_SEPARATOR,
	sms_allow_media: constants.SMS_ALLOW_MEDIA,
	sms_date_format: constants.SMS_DATE_FORMAT,
	sms_datetime_format: constants.SMS_DATETIME_FORMAT,
	sms_response: constants.SMS_RESPONSE,
	compact_tag: ["instance", "odk:tag"],
	read_only: ["bind", "readonly"],
	readonly: ["bind", "readonly"],
	relevant: ["bind", "relevant"],
	caption: constants.LABEL,
	appearance: ["control", "appearance"],
	relevance: ["bind", "relevant"],
	required: ["bind", "required"],
	constraint: ["bind", "constraint"],
	constraining_message: ["bind", "jr:constraintMsg"],
	constraint_message: ["bind", "jr:constraintMsg"],
	calculation: ["bind", "calculate"],
	calculate: ["bind", "calculate"],
	command: constants.TYPE,
	tag: constants.NAME,
	value: constants.NAME,
	image: ["media", "image"],
	"big-image": ["media", "big-image"],
	audio: ["media", "audio"],
	video: ["media", "video"],
	count: ["control", "jr:count"],
	repeat_count: ["control", "jr:count"],
	"jr:count": ["control", "jr:count"],
	autoplay: ["control", "autoplay"],
	rows: ["control", "rows"],
	noapperrorstring: ["bind", "jr:noAppErrorString"],
	no_app_error_string: ["bind", "jr:noAppErrorString"],
	requiredmsg: ["bind", "jr:requiredMsg"],
	required_message: ["bind", "jr:requiredMsg"],
	body: "control",
	trigger: "trigger",
	[constants.ENTITIES_SAVETO]: ["bind", constants.ENTITIES_SAVETO_NS],
};

export const entitiesHeader: Record<string, string> = {
	[constants.LIST_NAME_U]: "dataset",
};

export const TRANSLATABLE_SURVEY_COLUMNS: Record<
	string,
	string | [string, string]
> = {
	[constants.LABEL]: constants.LABEL,
	[constants.HINT]: constants.HINT,
	guidance_hint: "guidance_hint",
	image: surveyHeader.image as [string, string],
	"big-image": surveyHeader["big-image"] as [string, string],
	audio: surveyHeader.audio as [string, string],
	video: surveyHeader.video as [string, string],
	"jr:constraintMsg": "constraint_message",
	"jr:requiredMsg": "required_message",
	constraint_message: "constraint_message",
	required_message: "required_message",
};

export const TRANSLATABLE_CHOICES_COLUMNS: Record<
	string,
	string | [string, string]
> = {
	label: constants.LABEL,
	image: surveyHeader.image as [string, string],
	"big-image": surveyHeader["big-image"] as [string, string],
	audio: surveyHeader.audio as [string, string],
	video: surveyHeader.video as [string, string],
};

export const listHeader: Record<string, string | [string, string]> = {
	caption: constants.LABEL,
	[constants.LIST_NAME_U]: constants.LIST_NAME_S,
	value: constants.NAME,
	image: surveyHeader.image as [string, string],
	"big-image": surveyHeader["big-image"] as [string, string],
	audio: surveyHeader.audio as [string, string],
	video: surveyHeader.video as [string, string],
};

export const typeAliasMap: Record<string, string> = {
	imei: "deviceid",
	image: "photo",
	"add image prompt": "photo",
	"add photo prompt": "photo",
	"add audio prompt": "audio",
	"add video prompt": "video",
	"add file prompt": "file",
};

export const yesNo: Record<string, boolean> = {
	yes: true,
	Yes: true,
	YES: true,
	true: true,
	True: true,
	TRUE: true,
	"true()": true,
	no: false,
	No: false,
	NO: false,
	false: false,
	False: false,
	FALSE: false,
	"false()": false,
};

export const osmAliases: Record<string, string> = {
	osm: constants.OSM_TYPE,
};

export const BINDING_CONVERSIONS: Record<string, string> = {
	yes: "true()",
	Yes: "true()",
	YES: "true()",
	true: "true()",
	True: "true()",
	TRUE: "true()",
	no: "false()",
	No: "false()",
	NO: "false()",
	false: "false()",
	False: "false()",
	FALSE: "false()",
};
