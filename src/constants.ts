export const TYPE = "type";
export const TITLE = "title";
export const NAME = "name";
export const ENTITIES_SAVETO = "save_to";
export const ENTITIES_SAVETO_NS = "entities:saveto";
export const ID_STRING = "id_string";
export const SMS_KEYWORD = "sms_keyword";
export const SMS_FIELD = "sms_field";
export const SMS_OPTION = "sms_option";
export const SMS_SEPARATOR = "sms_separator";
export const SMS_ALLOW_MEDIA = "sms_allow_media";
export const SMS_DATE_FORMAT = "sms_date_format";
export const SMS_DATETIME_FORMAT = "sms_datetime_format";
export const SMS_RESPONSE = "sms_response";

export const COMPACT_PREFIX = "prefix";
export const COMPACT_DELIMITER = "delimiter";
export const COMPACT_TAG = "compact_tag";

export const VERSION = "version";
export const PUBLIC_KEY = "public_key";
export const SUBMISSION_URL = "submission_url";
export const AUTO_SEND = "auto_send";
export const AUTO_DELETE = "auto_delete";
export const CLIENT_EDITABLE = "client_editable";
export const DEFAULT_FORM_NAME = "data";
export const DEFAULT_LANGUAGE_KEY = "default_language";
export const DEFAULT_LANGUAGE_VALUE = "default";
export const LABEL = "label";
export const HINT = "hint";
export const STYLE = "style";
export const ATTRIBUTE = "attribute";
export const ALLOW_CHOICE_DUPLICATES = "allow_choice_duplicates";

export const BIND = "bind";
export const MEDIA = "media";
export const CONTROL = "control";
export const APPEARANCE = "appearance";
export const ITEMSET = "itemset";
export const RANDOMIZE = "randomize";
export const CHOICE_FILTER = "choice_filter";
export const PARAMETERS = "parameters";

export const LOOP = "loop";
export const COLUMNS = "columns";

export const REPEAT = "repeat";
export const GROUP = "group";
export const CHILDREN = "children";

export const SELECT_ONE = "select one";
export const SELECT_ONE_EXTERNAL = "select one external";
export const SELECT_ALL_THAT_APPLY = "select all that apply";
export const SELECT_OR_OTHER_SUFFIX = " or specify other";
export const RANK = "rank";
export const QUESTION = "question";
export const CHOICE = "choice";
export const CHOICES = "choices";

export const LIST_NAME_S = "list name";
export const LIST_NAME_U = "list_name";
export const CASCADING_SELECT = "cascading_select";
export const TABLE_LIST = "table-list";
export const FIELD_LIST = "field-list";
export const LIST_NOLABEL = "list-nolabel";

export const SURVEY = "survey";
export const SETTINGS = "settings";
export const EXTERNAL_CHOICES = "external_choices";
export const ENTITIES = "entities";

export const OSM = "osm";
export const OSM_TYPE = "binary";

export const NAMESPACES = "namespaces";
export const META = "meta";

export const SUPPORTED_SHEET_NAMES = new Set([
	SURVEY,
	CHOICES,
	SETTINGS,
	EXTERNAL_CHOICES,
	OSM,
	ENTITIES,
]);

export const XLS_EXTENSIONS = new Set([".xls"]);
export const XLSX_EXTENSIONS = new Set([".xlsx", ".xlsm"]);
export const SUPPORTED_FILE_EXTENSIONS = new Set([
	...XLS_EXTENSIONS,
	...XLSX_EXTENSIONS,
]);

export const LOCATION_PRIORITY = "location-priority";
export const LOCATION_MIN_INTERVAL = "location-min-interval";
export const LOCATION_MAX_AGE = "location-max-age";
export const TRACK_CHANGES = "track-changes";
export const IDENTIFY_USER = "identify-user";
export const TRACK_CHANGES_REASONS = "track-changes-reasons";

export const EXTERNAL_INSTANCES = new Set([
	"calculate",
	"constraint",
	"readonly",
	"required",
	"relevant",
]);

export const CURRENT_XFORMS_VERSION = "1.0.0";

export const ENTITY = "entity";
export const ENTITY_VERSION = "entity_version";
export const ENTITIES_RESERVED_PREFIX = "__";

export const DEPRECATED_DEVICE_ID_METADATA_FIELDS = new Set([
	"subscriberid",
	"simserial",
]);

export const AUDIO_QUALITY_VOICE_ONLY = "voice-only";
export const AUDIO_QUALITY_LOW = "low";
export const AUDIO_QUALITY_NORMAL = "normal";
export const AUDIO_QUALITY_EXTERNAL = "external";

export const EXTERNAL_INSTANCE_EXTENSIONS = new Set([".xml", ".csv", ".geojson"]);

export const DEFAULT_ITEMSET_LABEL_REF = "label";
export const DEFAULT_ITEMSET_VALUE_REF = "name";

export const EXTERNAL_CHOICES_ITEMSET_REF_LABEL_GEOJSON = "title";
export const EXTERNAL_CHOICES_ITEMSET_REF_VALUE_GEOJSON = "id";

export const ROW_FORMAT_STRING = "[row : %s]";

export const CONVERTIBLE_BIND_ATTRIBUTES = new Set([
	"readonly",
	"required",
	"relevant",
	"constraint",
	"calculate",
]);

export const NSMAP: Record<string, string> = {
	xmlns: "http://www.w3.org/2002/xforms",
	"xmlns:h": "http://www.w3.org/1999/xhtml",
	"xmlns:ev": "http://www.w3.org/2001/xml-events",
	"xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
	"xmlns:jr": "http://openrosa.org/javarosa",
	"xmlns:orx": "http://openrosa.org/xforms",
	"xmlns:odk": "http://www.opendatakit.org/xforms",
};

export const SUPPORTED_MEDIA_TYPES = new Set([
	"image",
	"big-image",
	"audio",
	"video",
]);

export const OR_OTHER_CHOICE = { [NAME]: "other", [LABEL]: "Other" };
export const RESERVED_NAMES_SURVEY_SHEET = new Set([META]);
