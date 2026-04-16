/**
 * Port of test_settings.py - Settings sheet tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("TestSettings", () => {
	it("should find the title set in the XForm", () => {
		const md = `
			| settings |
			|          | form_title |
			|          | My Form    |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: ["/h:html/h:head/h:title[text()='My Form']"],
		});
	});

	it("should find the instance id set in the XForm", () => {
		const md = `
			| settings |
			|          | form_id |
			|          | my_form |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/@id[.='my_form']",
			],
		});
	});

	it("should allow a custom name with valid characters from sheet", () => {
		const md = `
			| settings |
			| | name             |
			| | master-form_v2.1 |

			| survey |
			| | type  | name | label |
			| | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:instance/*[
				  namespace-uri()='http://www.w3.org/2002/xforms'
				  and local-name()='master-form_v2.1'
				]`,
			],
		});
	});

	it("should raise an error if the form_name from sheet is not valid", () => {
		const md = `
			| settings |
			| | name         |
			| | bad@filename |

			| survey |
			| | type  | name | label |
			| | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			errored: true,
			error__contains: [
				"[row : 1] On the 'settings' sheet, the 'name' value is invalid.",
			],
		});
	});

	it("should allow a custom form_name with valid characters from file", () => {
		const md = `
			| survey |
			| | type  | name | label |
			| | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			name: "master-form_v2.1",
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:instance/*[
				  namespace-uri()='http://www.w3.org/2002/xforms'
				  and local-name()='master-form_v2.1'
				]`,
			],
		});
	});

	it("should raise an error if the form_name from file is not valid", () => {
		const md = `
			| survey |
			| | type  | name | label |
			| | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			name: "bad@filename",
			errored: true,
			error__contains: ["The 'form_name' value is invalid."],
		});
	});

	it("should find clean_text_values=yes collapses survey sheet whitespace", () => {
		const md = `
			| survey  |                    |      |       |             |
			|         | type               | name | label | calculation |
			|         | integer            | q1   | Q1    | string-length('abc  def') |
			|         | select_one c1      | q2   | Q2    |             |
			|         | select_multiple c2 | q3   | Q3    |             |
			| choices  |
			|          | list_name | name | label |
			|          | c1        | a  b | c  1  |
			|          | c2        | b    | c  2  |
			| settings |                   |
			|          | clean_text_values |
			|          | yes               |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:bind[
				  @nodeset='/test_name/q1'
				  and @calculate="string-length('abc def')"
				]`,
				`/h:html/h:head/x:model/x:instance[@id='c1']/x:root[
				  ./x:item/x:name/text() = 'a  b' and ./x:item/x:label/text() = 'c  1'
				]`,
				`/h:html/h:head/x:model/x:instance[@id='c2']/x:root[
				  ./x:item/x:name/text() = 'b' and ./x:item/x:label/text() = 'c  2'
				]`,
			],
		});
	});

	it("should find clean_text_values=no leaves survey sheet whitespace as-is", () => {
		const md = `
			| survey  |                    |      |       |             |
			|         | type               | name | label | calculation |
			|         | integer            | q1   | Q1    | string-length('abc  def') |
			|         | select_one c1      | q2   | Q2    |             |
			|         | select_multiple c2 | q3   | Q3    |             |
			| choices  |
			|          | list_name | name | label |
			|          | c1        | a  b | c  1  |
			|          | c2        | b    | c  2  |
			| settings |                   |
			|          | clean_text_values |
			|          | no                |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:bind[
				  @nodeset='/test_name/q1'
				  and @calculate="string-length('abc  def')"
				]`,
				`/h:html/h:head/x:model/x:instance[@id='c1']/x:root[
				  ./x:item/x:name/text() = 'a  b' and ./x:item/x:label/text() = 'c  1'
				]`,
				`/h:html/h:head/x:model/x:instance[@id='c2']/x:root[
				  ./x:item/x:name/text() = 'b' and ./x:item/x:label/text() = 'c  2'
				]`,
			],
		});
	});

	it("should find a binding to set the instance name from the reference", () => {
		const md = `
			| settings |
			| | instance_name |
			| | \${q1}         |

			| survey |
			| | type  | name | label |
			| | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:bind[
				  @calculate=' /test_name/q1 '
				  and @nodeset='/test_name/meta/instanceName'
				  and @type='string'
				]`,
			],
		});
	});

	it("should raise an error if the referenced name is not in the survey sheet", () => {
		const md = `
			| settings |
			| | instance_name |
			| | \${q2}         |

			| survey |
			| | type  | name | label |
			| | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			errored: true,
			error__contains: [
				"[row : 2] On the 'settings' sheet, the 'instance_name' value is invalid.",
				"Could not find the name 'q2'.",
			],
		});
	});

	it("should find an instanceID child in the survey-level meta element", () => {
		const md = `
			| survey |
			| | type  | name | label |
			| | text  | q1   | Q1    |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:meta/x:instanceID",
				`/h:html/h:head/x:model/x:bind[
				  @nodeset='/test_name/meta/instanceID'
				  and @type='string'
				  and @readonly='true()'
				  and @jr:preload='uid'
				]`,
			],
		});
	});

	it("should find that the instance_id bind can be changed via instance_id setting", () => {
		const md = `
			| settings |
			| | instance_id |
			| | x           |

			| survey |
			| | type  | name | label |
			| | text  | q1   | Q1    |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:meta/x:instanceID",
				`/h:html/h:head/x:model/x:bind[
				  @nodeset='/test_name/meta/instanceID'
				  and @type='string'
				  and @readonly='true()'
				  and @jr:preload='x'
				]`,
			],
		});
	});

	it("should find that instanceID can be excluded with omit_instanceID no meta", () => {
		const md = `
			| settings |
			| | omit_instanceID |
			| | yes             |

			| survey |
			| | type  | name | label |
			| | text  | q1   | Q1    |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name[not(./x:meta)]",
				"/h:html/h:head/x:model[not(./x:bind[@nodeset='/test_name/meta/instanceID'])]",
			],
		});
	});

	it("should find that instanceID can be excluded with omit_instanceID with meta", () => {
		const md = `
			| settings |
			| | omit_instanceID | instance_name |
			| | yes             | x             |

			| survey |
			| | type  | name | label |
			| | text  | q1   | Q1    |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:meta[not(./x:instanceID)]",
				"/h:html/h:head/x:model[not(./x:bind[@nodeset='/test_name/meta/instanceID'])]",
			],
		});
	});

	it("should find that instanceID can be used as reference variable", () => {
		const md = `
			| survey |
			| | type  | name | label              | calculation        | read_only |
			| | text  | q1   | \${instanceID} |                    |           |
			| | text  | q2   | Q2                 | \${instanceID} | yes       |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:meta/x:instanceID",
				`/h:html/h:body/x:input[@ref='/test_name/q1']/x:label/x:output[
				  @value=' /test_name/meta/instanceID '
				]`,
				`/h:html/h:head/x:model/x:bind[
				  @nodeset='/test_name/q2'
				  and @type='string'
				  and @readonly='true()'
				  and @calculate=' /test_name/meta/instanceID '
				]`,
			],
		});
	});

	it("should raise an error when instanceID reference used with omit_instanceID", () => {
		const md = `
			| settings |
			| | omit_instanceID |
			| | yes             |

			| survey |
			| | type  | name | label              | calculation        | read_only |
			| | text  | q1   | \${instanceID} |                    |           |
		`;
		assertPyxformXform({
			md,
			errored: true,
			error__contains: [
				"[row : 2] On the 'survey' sheet, the 'label' value is invalid.",
				"Could not find the name 'instanceID'.",
			],
		});
	});
});

describe("TestNamespaces", () => {
	it("should find the standard namespaces in the XForm output", () => {
		const md = `
			| survey |      |      |       |
			|        | type | name | label |
			|        | note | q    | Q     |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html[namespace::*[name()='']='http://www.w3.org/2002/xforms']",
				"/h:html[namespace::h='http://www.w3.org/1999/xhtml']",
				"/h:html[namespace::jr='http://openrosa.org/javarosa']",
				"/h:html[namespace::orx='http://openrosa.org/xforms']",
				"/h:html[namespace::xsd='http://www.w3.org/2001/XMLSchema']",
			],
		});
	});

	it("should find any custom namespaces in the XForm", () => {
		const md = `
			| settings |            |
			|          | namespaces |
			|          | esri="http://esri.com/xforms" enk="http://enketo.org/xforms" naf="http://nafundi.com/xforms" |
			| survey   |      |      |       |
			|          | type | name | label |
			|          | note | q    | Q     |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html[namespace::*[name()='']='http://www.w3.org/2002/xforms']",
				"/h:html[namespace::h='http://www.w3.org/1999/xhtml']",
				"/h:html[namespace::jr='http://openrosa.org/javarosa']",
				"/h:html[namespace::orx='http://openrosa.org/xforms']",
				"/h:html[namespace::xsd='http://www.w3.org/2001/XMLSchema']",
				"/h:html[namespace::esri='http://esri.com/xforms']",
				"/h:html[namespace::enk='http://enketo.org/xforms']",
				"/h:html[namespace::naf='http://nafundi.com/xforms']",
			],
		});
	});

	it("should find custom namespaced instance attribute", () => {
		const md = `
			| settings |            |
			|          | namespaces |
			|          | ex="http://example.com/xforms" |
			| survey  |         |            |       |                        |
			|         | type    | name       | label | instance::ex:duration |
			|         | trigger | my_trigger | T1    | 10                     |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html[namespace::ex='http://example.com/xforms']",
				`/h:html/h:head/x:model/x:instance/x:test_name/x:my_trigger/@*[
				  local-name()='duration'
				  and namespace-uri()='http://example.com/xforms'
				  and .='10'
				]`,
			],
		});
	});

	it("should find the instance_xmlns value in the instance xmlns attribute", () => {
		const md = `
			| settings |
			|          | instance_xmlns            |
			|          | http://example.com/xforms |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:instance/*[
				  namespace-uri()='http://example.com/xforms'
				  and local-name()='test_name'
				  and @id='data'
				]`,
			],
		});
	});

	it("should find the XForms namespace for the instance element when not set", () => {
		const md = `
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:instance/*[
				  namespace-uri()='http://www.w3.org/2002/xforms'
				  and local-name()='test_name'
				  and @id='data'
				]`,
			],
		});
	});

	it("should find the instance attribute in the default namespace", () => {
		const md = `
			| settings |
			|          | attribute::xyz |
			|          | 1234           |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:instance/x:test_name/@*[
				  namespace-uri()=''
				  and local-name()='xyz'
				  and .='1234'
				]`,
			],
		});
	});

	it("should find the instance attribute in the custom namespace", () => {
		const md = `
			| settings |
			|          | attribute::ex:xyz | namespaces                     |
			|          | 1234              | ex="http://example.com/xforms" |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				"/h:html[namespace::ex='http://example.com/xforms']",
				`/h:html/h:head/x:model/x:instance/x:test_name/@*[
				  namespace-uri()='http://example.com/xforms'
				  and local-name()='xyz'
				  and .='1234'
				]`,
			],
		});
	});

	it("should find the multiple instance attributes in the default namespace", () => {
		const md = `
			| settings |
			|          | attribute::xyz | attribute::abc |
			|          | 1234           | 5678           |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		assertPyxformXform({
			md,
			xml__xpath_match: [
				`/h:html/h:head/x:model/x:instance/x:test_name/@*[
				  namespace-uri()=''
				  and local-name()='xyz'
				  and .='1234'
				]`,
				`/h:html/h:head/x:model/x:instance/x:test_name/@*[
				  namespace-uri()=''
				  and local-name()='abc'
				  and .='5678'
				]`,
			],
		});
	});

	it("should find the odk:client-editable attribute when active", () => {
		const md1 = `
			| settings |
			|          | client_editable |
			|          | yes             |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		const md2 = `
			| settings |
			|          | client_editable |
			|          | true            |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		for (const md of [md1, md2]) {
			assertPyxformXform({
				md,
				xml__xpath_match: [
					`/h:html/h:head/x:model/x:submission[@odk:client-editable = 'true']`,
				],
			});
		}
	});

	it("should not find the odk:client-editable attribute when inactive", () => {
		const md1 = `
			| settings |
			|          | client_editable |
			|          | no              |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		const md2 = `
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		for (const md of [md1, md2]) {
			assertPyxformXform({
				md,
				xml__xpath_match: [
					"/h:html/h:head/x:model[not(./x:submission/@odk:client-editable)]",
				],
			});
		}
		const md3 = `
			| settings |
			|          | client_editable | auto_send |
			|          | false           | true      |
			| survey |       |      |       |
			|        | type  | name | label |
			|        | text  | q1   | hello |
		`;
		assertPyxformXform({
			md: md3,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:submission[not(@odk:client-editable)]",
			],
		});
	});
});
