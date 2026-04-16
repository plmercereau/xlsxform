import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

describe("SetGeopointTest", () => {
	it("test_setgeopoint", () => {
		assertPyxformXform({
			name: "data",
			md: `
			| survey |                |             |          |
			|        | type           | name        | label    |
			|        | start-geopoint | my-location | my label |
			`,
			xml__contains: [
				'<bind nodeset="/data/my-location" type="geopoint"/>',
				'<odk:setgeopoint event="odk-instance-first-load" ref="/data/my-location"/>',
				"",
			],
		});
	});
});
