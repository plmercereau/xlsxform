/**
 * Port of pyxform/tests/test_osm.py - Test OSM widgets.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

const expected_xml_output = `
    <upload mediatype="osm/*" ref="/osm/osm_building">
      <label>Building</label>
      <tag key="name">
        <label>Name</label>
      </tag>
      <tag key="addr:city">
        <label>City</label>
      </tag>
    </upload>`;

// XPath helper functions ported from pyxform/tests/xpath_helpers/questions.py
function xpq_model_instance_item(q_name: string): string {
	return `/h:html/h:head/x:model/x:instance/x:test_name/x:${q_name}`;
}
function xpq_model_instance_bind(q_name: string, _type: string): string {
	return `/h:html/h:head/x:model/x:bind[@nodeset='/test_name/${q_name}' and @type='${_type}']`;
}
function xpq_body_label_inline(
	q_type: string,
	q_name: string,
	q_label: string,
): string {
	return `/h:html/h:body/x:${q_type}[@ref='/test_name/${q_name}']/x:label[not(@ref) and text()='${q_label}']`;
}
function _xpq_body_label_itext(q_type: string, q_name: string): string {
	return `/h:html/h:body/x:${q_type}[@ref='/test_name/${q_name}']/x:label[@ref="jr:itext('/test_name/${q_name}:label')" and not(text())]`;
}
function _xpq_model_instance_exists(i_id: string): string {
	return `/h:html/h:head/x:model[./x:instance[@id='${i_id}']]`;
}
function _xpq_model_itext_label(
	q_name: string,
	lang: string,
	q_label: string,
): string {
	return `/h:html/h:head/x:model/x:itext/x:translation[@lang='${lang}']/x:text[@id='/test_name/${q_name}:label']/x:value[not(@form) and text()='${q_label}']`;
}
function xpq_body_upload_tags(qname: string, tags: [string, string][]): string {
	const tags_xp = tags
		.map(([k, v]) => `./x:tag[@key='${k}']/x:label[text()='${v}']`)
		.join("\n          and ");
	return `/h:html/h:body/x:upload[@ref='/test_name/${qname}' and @mediatype='osm/*' and ${tags_xp}]`;
}

// XPath helper functions ported from pyxform/tests/xpath_helpers/choices.py
function xpc_model_instance_choices_label(
	cname: string,
	choices: [string, string][],
): string {
	const choices_xp = choices
		.map(
			([cv, cl]) =>
				`./x:item/x:name/text() = '${cv}' and ./x:item/x:label/text() = '${cl}'`,
		)
		.join("\n              and ");
	return `/h:html/h:head/x:model/x:instance[@id='${cname}']/x:root[${choices_xp}]`;
}

describe("OSMWidgetsTest", () => {
	it("test_osm_type", () => {
		assertPyxformXform({
			name: "osm",
			md: `
				| survey |                   |              |          |
				|        | type              |   name       | label    |
				|        | osm               | osm_road     | Road     |
				|        | osm building_tags | osm_building | Building |
				| osm    |                   |              |          |
				|        | list name         |  name        | label    |
				|        | building_tags     | name         | Name     |
				|        | building_tags     | addr:city    | City     |
			`,
			xml__contains: [expected_xml_output],
		});
	});

	it("test_osm_type_with_list_underscore_name", () => {
		assertPyxformXform({
			name: "osm",
			md: `
				| survey |                   |              |          |
				|        | type              |   name       | label    |
				|        | osm               | osm_road     | Road     |
				|        | osm building_tags | osm_building | Building |
				| osm    |                   |              |          |
				|        | list_name         |  name        | label    |
				|        | building_tags     | name         | Name     |
				|        | building_tags     | addr:city    | City     |
			`,
			xml__contains: [expected_xml_output],
		});
	});

	it("test_osm_type_with_select", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type              | name      | label    |
				|         | osm               | osm_road  | Road     |
				|         | osm building_tags | osm_build | Building |
				|         | select_one c1     | q1        | Q1       |
				| osm     |
				|         | list_name     | name      | label |
				|         | building_tags | name      | Name  |
				|         | building_tags | addr:city | City  |
				| choices |
				|         | list_name | name | label |
				|         | c1        | n1   | l1    |
				|         | c1        | n2   | l2    |
			`,
			xml__xpath_match: [
				xpq_model_instance_item("q1"),
				xpq_model_instance_bind("q1", "string"),
				xpq_body_label_inline("select1", "q1", "Q1"),
				xpc_model_instance_choices_label("c1", [
					["n1", "l1"],
					["n2", "l2"],
				]),
				xpq_model_instance_item("osm_road"),
				xpq_model_instance_bind("osm_road", "binary"),
				xpq_body_label_inline("upload", "osm_road", "Road"),
				xpq_model_instance_item("osm_build"),
				xpq_model_instance_bind("osm_build", "binary"),
				xpq_body_label_inline("upload", "osm_build", "Building"),
				xpq_body_upload_tags("osm_build", [
					["name", "Name"],
					["addr:city", "City"],
				]),
			],
			xml__excludes: ["room_tags"],
		});
	});

	it("test_osm_type_with_multiple_lists__separate", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type              | name      | label    |
				|         | osm               | osm_road  | Road     |
				|         | osm building_tags | osm_build | Building |
				|         | osm room_tags     | osm_room  | Room     |
				| osm     |
				|         | list_name     | name       | label     |
				|         | building_tags | name       | Name      |
				|         | building_tags | addr:city  | City      |
				|         | room_tags     | room:type  | Type      |
				|         | room_tags     | habitable  | Habitable |
			`,
			xml__xpath_match: [
				xpq_model_instance_item("osm_road"),
				xpq_model_instance_bind("osm_road", "binary"),
				xpq_body_label_inline("upload", "osm_road", "Road"),
				xpq_model_instance_item("osm_build"),
				xpq_model_instance_bind("osm_build", "binary"),
				xpq_body_label_inline("upload", "osm_build", "Building"),
				xpq_body_upload_tags("osm_build", [
					["name", "Name"],
					["addr:city", "City"],
				]),
				xpq_model_instance_item("osm_room"),
				xpq_model_instance_bind("osm_room", "binary"),
				xpq_body_label_inline("upload", "osm_room", "Room"),
				xpq_body_upload_tags("osm_room", [
					["room:type", "Type"],
					["habitable", "Habitable"],
				]),
			],
			xml__excludes: ["building_tags", "room_tags"],
		});
	});

	it("test_osm_type_with_multiple_lists__shared", () => {
		assertPyxformXform({
			md: `
				| survey  |
				|         | type          | name       | label       |
				|         | osm room_tags | osm_resi   | Residential |
				|         | osm room_tags | osm_office | Office      |
				| osm     |
				|         | list_name     | name       | label     |
				|         | room_tags     | room:type  | Type      |
				|         | room_tags     | habitable  | Habitable |
			`,
			xml__xpath_match: [
				xpq_model_instance_item("osm_resi"),
				xpq_model_instance_bind("osm_resi", "binary"),
				xpq_body_label_inline("upload", "osm_resi", "Residential"),
				xpq_body_upload_tags("osm_resi", [
					["room:type", "Type"],
					["habitable", "Habitable"],
				]),
				xpq_model_instance_item("osm_office"),
				xpq_model_instance_bind("osm_office", "binary"),
				xpq_body_label_inline("upload", "osm_office", "Office"),
				xpq_body_upload_tags("osm_office", [
					["room:type", "Type"],
					["habitable", "Habitable"],
				]),
			],
			xml__excludes: ["room_tags"],
		});
	});
});
