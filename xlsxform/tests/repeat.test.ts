/**
 * Port of test_repeat.py - Repeat element tests.
 */

import { describe, it } from "vitest";
import { assertPyxformXform } from "./helpers/test-case.js";

/**
 * XPath helper functions matching pyxform's tests/xpath_helpers/questions.py XPathHelper class.
 */
const xpq = {
	model_instance_item: (qName: string) => `
		/h:html/h:head/x:model/x:instance/x:test_name/x:${qName}
	`,
	model_instance_bind: (qName: string, type: string) => `
		/h:html/h:head/x:model/x:bind[
			@nodeset='/test_name/${qName}'
			and @type='${type}'
		]
	`,
	model_instance_bind_attr: (qname: string, key: string, value: string) => `
		/h:html/h:head/x:model/x:bind[
			@nodeset='/test_name/${qname}'
			and @${key}="${value}"
		]
	`,
	body_control: (
		qname: string,
		controlType: string,
		namespace = "http://www.w3.org/2002/xforms",
	) => `
		/h:html/h:body/*[
			namespace-uri()='${namespace}'
			and local-name()='${controlType}'
			and @ref = '/test_name/${qname}'
		]
	`,
	setvalue: (opts: {
		path: string;
		ref: string;
		event: string;
		value?: string;
	}) => {
		const valuePart = opts.value ? `and @value="${opts.value}" ` : "";
		return `
		/h:html/${opts.path}/x:setvalue[
			@ref='${opts.ref}'
			and @event='${opts.event}'
			${valuePart}
		]
		`;
	},
};

describe("TestRepeatOutput", () => {
	it("should handle repeat relative reference", () => {
		assertPyxformXform({
			md: `
				| survey |              |          |            |                      |
				|        | type         | name     | relevant   | label                |
				|        | text         | Z        |            | Fruit                |
				|        | begin repeat | section  |            | Section              |
				|        | text         | AA       |            | Anything really      |
				|        | text         | A        |            | A oat                |
				|        | text         | B        | \${A}='oat' | B w \${A}             |
				|        | note         | note1    |            | Noted \${AA} w \${A}   |
				|        | end repeat   |          |            |                      |
				|        |              |          |            |                      |
				|        | begin repeat | section2 |            | Section 2            |
				|        | text         | C        |            | C                    |
				|        | begin group  | sectiona |            | Section A            |
				|        | text         | D        |            | D oat                |
				|        | text         | E        | \${D}='oat' | E w \${Z}             |
				|        | note         | note2    |            | Noted \${C} w \${E}    |
				|        | end group    |          |            |                      |
				|        | note         | note3    |            | Noted \${C} w \${E}    |
				|        | end repeat   |          |            |                      |
				|        |              |          |            |                      |
				|        | begin repeat | section3 |            | Section 3            |
				|        | text         | FF       |            | F any text           |
				|        | text         | F        |            | F oat                |
				|        | begin group  | sectionb |            | Section B            |
				|        | text         | G        |            | G oat                |
				|        | text         | H        | \${G}='oat' | H w \${Z}             |
				|        | note         | note4    |            | Noted \${H} w \${Z}    |
				|        | end group    |          |            |                      |
				|        | begin repeat | sectionc |            | Section B            |
				|        | text         | I        |            | I                    |
				|        | text         | J        | \${I}='oat' | J w \${Z}             |
				|        | text         | K        | \${F}='oat' | K w \${Z}             |
				|        | text         | L        | \${G}='oat' | K w \${Z}             |
				|        | note         | note5    |            | Noted \${FF} w \${H}   |
				|        | note         | note6    |            | JKL #\${J}#\${K}#\${L}  |
				|        | end repeat   |          |            |                      |
				|        | note         | note7    |            | Noted \${FF} w \${H}   |
				|        | begin group  | sectiond |            | Section D            |
				|        | text         | M        |            | M oat                |
				|        | text         | N        | \${G}='oat' | N w \${Z}             |
				|        | text         | O        | \${M}='oat' | O w \${Z}             |
				|        | note         | note8    |            | NO #\${N} #\${O}       |
				|        | end group    |          |            |                      |
				|        | note         | note9    |            | \${FF} \${H} \${N} \${N} |
				|        | end repeat   |          |            |                      |
				|        |              |          |            |                      |
			`,
			instance__contains: [
				'<section jr:template="">',
				"<A/>",
				"<B/>",
				"</section>",
			],
			model__contains: [
				`<bind nodeset="/test_name/section/A" type="string"/>`,
				`<bind nodeset="/test_name/section/B" relevant=" ../A ='oat'" type="string"/>`,
				`<bind nodeset="/test_name/section2/sectiona/E" relevant=" ../D ='oat'" type="string"/>`,
				`<bind nodeset="/test_name/section3/sectionc/K" relevant=" ../../F ='oat'" type="string"/>`,
				`<bind nodeset="/test_name/section3/sectionc/L" relevant=" ../../sectionb/G ='oat'" type="string"/>`,
				`<bind nodeset="/test_name/section3/sectiond/N" relevant=" ../../sectionb/G ='oat'" type="string"/>`,
			],
			xml__contains: [
				'<group ref="/test_name/section">',
				"<label>Section</label>",
				"</group>",
				`<label> B w <output value=" ../A "/> </label>`,
				`<label> E w <output value=" /test_name/Z "/> </label>`,
				`<label> Noted <output value=" ../FF "/> w <output value=" ../sectionb/H "/> </label>`,
			],
		});
	});

	it("should handle calculate relative path", () => {
		assertPyxformXform({
			md: `
				| survey  |                      |       |        |                |
				|         | type                 | name  | label  | calculation    |
				|         | begin repeat         | rep   |        |                |
				|         | select_one crop_list | crop  | Select |                |
				|         | text                 | a     | Verify | name = \${crop} |
				|         | begin group          | group |        |                |
				|         | text                 | b     | Verify | name = \${crop} |
				|         | end group            |       |        |                |
				|         | end repeat           |       |        |                |
				|         |                      |       |        |                |
				| choices |                      |       |        |                |
				|         | list name            | name  | label  |                |
				|         | crop_list            | maize | Maize  |                |
				|         | crop_list            | beans | Beans  |                |
				|         | crop_list            | kale  | Kale   |                |
			`,
			model__contains: [
				`<bind calculate="name =  ../crop " nodeset="/test_name/rep/a" type="string"/>`,
				`<bind calculate="name =  ../../crop " nodeset="/test_name/rep/group/b" type="string"/>`,
			],
		});
	});

	it("should handle choice filter relative path", () => {
		assertPyxformXform({
			md: `
				| survey  |                      |       |        |                |
				|         | type                 | name  | label  | choice_filter  |
				|         | begin repeat         | rep   |        |                |
				|         | select_one crop_list | crop  | Select |                |
				|         | select_one crop_list | a     | Verify | name = \${crop} |
				|         | begin group          | group |        |                |
				|         | select_one crop_list | b     | Verify | name = \${crop} |
				|         | end group            |       |        |                |
				|         | end repeat           |       |        |                |
				|         |                      |       |        |                |
				| choices |                      |       |        |                |
				|         | list name            | name  | label  |                |
				|         | crop_list            | maize | Maize  |                |
				|         | crop_list            | beans | Beans  |                |
				|         | crop_list            | kale  | Kale   |                |
			`,
			xml__contains: [
				`<itemset nodeset="instance('crop_list')/root/item[name =  current()/../crop ]">`,
				`<itemset nodeset="instance('crop_list')/root/item[name =  current()/../../crop ]">`,
			],
		});
	});

	it("should handle indexed repeat relative path", () => {
		assertPyxformXform({
			md: `
				| survey  |                      |       |        |                                  |
				|         | type                 | name  | label  | calculation                      |
				|         | begin repeat         | rep   |        |                                  |
				|         | begin repeat         | rep2  |        |                                  |
				|         | select_one crop_list | crop  | Select |                                  |
				|         | text                 | a     | Verify |                                  |
				|         | begin group          | group |        |                                  |
				|         | text                 | b     | Verify |                                  |
				|         | end group            |       |        |                                  |
				|         | end repeat           |       |        |                                  |
				|         | calculate            | c1    |        | indexed-repeat(\${a}, \${rep2}, 1) |
				|         | end repeat           |       |        |                                  |
				|         |                      |       |        |                                  |
				|         |                      |       |        |                                  |
				| choices |                      |       |        |                                  |
				|         | list name            | name  | label  |                                  |
				|         | crop_list            | maize | Maize  |                                  |
				|         | crop_list            | beans | Beans  |                                  |
				|         | crop_list            | kale  | Kale   |                                  |
			`,
			model__contains: [
				`<bind calculate="indexed-repeat( /test_name/rep/rep2/a ,  /test_name/rep/rep2 , 1)" nodeset="/test_name/rep/c1" type="string"/>`,
			],
		});
	});

	it("should handle output with translation relative path", () => {
		assertPyxformXform({
			md: `
				| survey |              |             |                |              |               |                             |                           |                           |
				|        | type         | name        | label::English | calculation  | hint::English | constraint_message::English | required_message::English | noAppErrorString::English |
				|        | begin repeat | member      |                |              |               |                             |                           |                           |
				|        | calculate    | pos         |                | position(..) |               |                             |                           |                           |
				|        | text         | member_name | Name of \${pos} |              |               |                             |                           |                           |
				|        | text         | a           | A              |              | hint \${pos}   | constraint \${pos}           | required \${pos}           | app error \${pos}          |
				|        | end repeat   |             |                |              |               |                             |                           |                           |
			`,
			xml__contains: [
				'<translation lang="English">',
				'<value> Name of <output value=" ../pos "/> </value>',
				'<value> hint <output value=" ../pos "/> </value>',
				'<value> constraint <output value=" ../pos "/> </value>',
				'<value> required <output value=" ../pos "/> </value>',
				'<value> app error <output value=" ../pos "/>',
			],
		});
	});

	it("should handle output with guidance hint translation relative path", () => {
		assertPyxformXform({
			md: `
				| survey |              |             |                |                        |              |
				|        | type         | name        | label::English | guidance_hint::English | calculation  |
				|        | begin repeat | member      |                |                        |              |
				|        | calculate    | pos         |                |                        | position(..) |
				|        | text         | member_name | Name of \${pos} | More \${pos}            |              |
				|        | end repeat   |             |                |                        |              |
			`,
			xml__contains: [
				'<translation lang="English">',
				'<value> Name of <output value=" ../pos "/> </value>',
				'<value form="guidance"> More <output value=" ../pos "/> </value>',
			],
		});
	});

	it("should handle output with multiple translations relative path", () => {
		assertPyxformXform({
			md: `
				| survey |              |                |                |                  |              |
				|        | type         | name           | label::English | label::Indonesia | calculation  |
				|        | begin repeat | member         |                |                  |              |
				|        | calculate    | pos            |                |                  | position(..) |
				|        | text         | member_name    | Name of \${pos} | Nama \${pos}      |              |
				|        | text         | member_address |                | Alamat           |              |
				|        | end repeat   |                |                |                  |              |
			`,
			xml__contains: [
				'<translation lang="English">',
				'<value> Name of <output value=" ../pos "/> </value>',
			],
		});
	});

	it("should not have hints present within repeats", () => {
		assertPyxformXform({
			md: `
				| survey |                   |                |                   |                      |
				|        | type              | name           | label             | hint                 |
				|        | begin repeat      | pets           | Pets              | Pet details          |
				|        | text              | pets_name      | Pet's name        | Pet's name hint      |
				|        | select_one pet    | pet_type       | Type of pet       | Type of pet hint     |
				|        | image             | pet_picture    | Picture of pet    | Take a nice photo    |
				|        | end repeat        |                |                   |                      |
				| choices|                   |                |                   |                      |
				|        | list name         | name           | label             |                      |
				|        | pet               | dog            | Dog               |                      |
				|        | pet               | cat            | Cat               |                      |
				|        | pet               | bird           | Bird              |                      |
				|        | pet               | fish           | Fish              |                      |
			`,
			xml__xpath_match: [
				`
				/h:html/h:body
				  /x:group[@ref='/test_name/pets' and not(./x:hint)]
				    /x:repeat[
				      @nodeset='/test_name/pets'
				      and ./x:input[@ref='/test_name/pets/pets_name' and ./x:hint]
				      and ./x:select1[@ref='/test_name/pets/pet_type' and ./x:hint]
				      and ./x:upload[@ref='/test_name/pets/pet_picture' and ./x:hint]
				    ]
				`,
			],
		});
	});

	it("should have hints present within groups", () => {
		assertPyxformXform({
			md: `
				| survey |                   |                        |                                                         |                              |
				|        | type              | name                   | label                                                   | hint                         |
				|        | begin group       | child_group            | Please enter birth information for each child born.     | Pet details                  |
				|        | text              | child_name             | Name of child?                                          | Should be a text             |
				|        | decimal           | birthweight            | Child birthweight (in kgs)?                             | Should be a decimal          |
				|        | end group         |                        |                                                         |                              |
			`,
			xml__contains: [
				`<group ref="/test_name/child_group">
      <label>Please enter birth information for each child born.</label>
      <input ref="/test_name/child_group/child_name">
        <label>Name of child?</label>
        <hint>Should be a text</hint>
      </input>
      <input ref="/test_name/child_group/birthweight">
        <label>Child birthweight (in kgs)?</label>
        <hint>Should be a decimal</hint>
      </input>
    </group>`,
			],
		});
	});

	it("should handle choice from previous repeat answers", () => {
		assertPyxformXform({
			md: `
				| survey  |                    |            |                |
				|         | type               | name       | label          |
				|         | begin repeat       | rep        | Repeat         |
				|         | text               | name       | Enter name     |
				|         | end repeat         |            |                |
				|         | select one \${name} | choice     | Choose name    |
			`,
			xml__contains: [
				`<itemset nodeset="/test_name/rep[./name != '']">`,
				'<value ref="name"/>',
				'<label ref="name"/>',
			],
		});
	});

	it("should handle choice from previous repeat answers not name", () => {
		assertPyxformXform({
			md: `
				| survey  |                      |            |                |
				|         | type                 | name       | label          |
				|         | begin repeat         | rep        | Repeat         |
				|         | text                 | answer     | Enter name     |
				|         | end repeat           |            |                |
				|         | select one \${answer} | choice     | Choose name    |
			`,
			xml__contains: [
				`<itemset nodeset="/test_name/rep[./answer != '']">`,
				'<value ref="answer"/>',
				'<label ref="answer"/>',
			],
		});
	});

	it("should handle choice from previous repeat answers with choice filter", () => {
		assertPyxformXform({
			md: `
				| survey  |                    |                |                |                           |
				|         | type               | name           | label          | choice_filter             |
				|         | begin repeat       | rep            | Repeat         |                           |
				|         | text               | name           | Enter name     |                           |
				|         | begin group        | demographics   | Demographics   |                           |
				|         | integer            | age            | Enter age      |                           |
				|         | end group          | demographics   |                |                           |
				|         | end repeat         |                |                |                           |
				|         | select one fruits  | fruit          | Choose a fruit |                           |
				|         | select one \${name} | choice         | Choose name    | starts-with(\${name}, "b")  |
				|         | select one \${name} | choice_18_over | Choose name    | \${age} > 18               |
				| choices |                    |                |                |                           |
				|         | list name          | name           | label          |                           |
				|         | fruits             | banana         | Banana         |                           |
				|         | fruits             | mango          | Mango          |                           |
			`,
			xml__contains: [
				'<itemset nodeset="/test_name/rep[starts-with( ./name , &quot;b&quot;)]">',
				'<itemset nodeset="/test_name/rep[ ./demographics/age  &gt; 18]">',
			],
		});
	});

	it("should handle choice from previous repeat answers in child repeat", () => {
		assertPyxformXform({
			md: `
				| survey  |                    |                           |                                                |                             |
				|         | type               | name                      | label                                          | choice_filter               |
				|         | begin repeat       | household                 | Household Repeat                               |                             |
				|         | begin repeat       | member                    | Household member repeat                        |                             |
				|         | text               | name                      | Enter name of a household member               |                             |
				|         | integer            | age                       | Enter age of the household member              |                             |
				|         | begin repeat       | adult                     | Select a representative                        |                             |
				|         | select one \${name} | adult_name                | Choose a name                                  | \${age} > 18                 |
				|         | end repeat         | adult                     |                                                |                             |
				|         | end repeat         | member                    |                                                |                             |
				|         | end repeat         | household                 |                                                |                             |
			`,
			xml__contains: ['<itemset nodeset="../../../member[ ./age  &gt; 18]">'],
		});
	});

	it("should handle choice from previous repeat answers in nested repeat", () => {
		assertPyxformXform({
			md: `
				| survey  |                    |                           |                                                |                             |
				|         | type               | name                      | label                                          | choice_filter               |
				|         | begin repeat       | household                 | Household Repeat                               |                             |
				|         | begin repeat       | person                    | Household member repeat                        |                             |
				|         | text               | name                      | Enter name of a household member               |                             |
				|         | integer            | age                       | Enter age of the household member              |                             |
				|         | end repeat         | person                    |                                                |                             |
				|         | begin repeat       | adult                     | Select a representative                        |                             |
				|         | select one \${name} | adult_name                | Choose a name                                  | \${age} > 18                 |
				|         | end repeat         | adult                     |                                                |                             |
				|         | end repeat         | household                 |                                                |                             |
			`,
			xml__contains: ['<itemset nodeset="../../person[ ./age  &gt; 18]">'],
		});
	});

	it("should handle choice from previous repeat answers in nested repeat uses current", () => {
		assertPyxformXform({
			md: `
				| survey  |                    |                           |                                                |                             |
				|         | type               | name                      | label                                          | choice_filter               |
				|         | text               | enumerators_name          | Enter enumerators name                         |                             |
				|         | begin repeat       | household_rep             | Household Repeat                               |                             |
				|         | integer            | household_id              | Enter household ID                             |                             |
				|         | begin repeat       | household_mem_rep         | Household member repeat                        |                             |
				|         | text               | name                      | Enter name of a household member               |                             |
				|         | integer            | age                       | Enter age of the household member              |                             |
				|         | end repeat         | household_mem_rep         |                                                |                             |
				|         | begin repeat       | selected                  | Select a representative                        |                             |
				|         | integer            | target_min_age            | Minimum age requirement                        |                             |
				|         | select one \${name} | selected_name             | Choose a name                                  | \${age} > \${target_min_age}  |
				|         | end repeat         | selected                  |                                                |                             |
				|         | end repeat         | household_rep             |                                                |                             |
			`,
			xml__contains: [
				'<itemset nodeset="../../household_mem_rep[ ./age  &gt;  current()/../target_min_age ]">',
			],
		});
	});

	it("should handle choice from previous repeat in current repeat parents out to repeat", () => {
		assertPyxformXform({
			md: `
				| survey       |                           |               |                        |                                                      |            |                       |              |
				|              | type                      | name          | label                  | choice_filter                                        | appearance | relevant              | calculation  |
				|              | begin_repeat              | pet           | Pet                    |                                                      | field_list |                       |              |
				|              | calculate                 | pos           |                        |                                                      |            |                       | position(..) |
				|              | select_one \${animal_type} | animal_select | Select the animal type | position() != current()/../pos and animal_type != '' |            |                       |              |
				|              | text                      | animal_type   | Animal type            |                                                      |            | \${animal_select} = '' |              |
				|              | end_repeat                | pet           |                        |                                                      |            |                       |              |
			`,
			xml__contains: [
				`<itemset nodeset="../../pet[position() != current()/../pos and animal_type != '']">`,
			],
		});
	});

	it("should handle indexed repeat regular calculation relative path exception", () => {
		assertPyxformXform({
			md: `
				| survey  |                |           |                                  |                                              |
				|         | type           | name      | label                            | calculation                                  |
				|         | begin_repeat   | person    | Person                           |                                              |
				|         | integer        | pos       |                                  | position(..)                                 |
				|         | text           | name      | Enter name                       |                                              |
				|         | text           | prev_name | Name in previous repeat instance | indexed-repeat(\${name}, \${person}, \${pos}-1) |
				|         | end repeat     |           |                                  |                                              |
			`,
			model__contains: [
				`<bind calculate="indexed-repeat( /test_name/person/name ,  /test_name/person ,  ../pos -1)" nodeset="/test_name/person/prev_name" type="string"/>`,
			],
		});
	});

	it("should handle indexed repeat dynamic default relative path exception", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label                            | default                                      |
				| | begin_repeat | r1   | Person                           |                                              |
				| | text         | q1   | Enter name                       |                                              |
				| | text         | q2   | Name in previous repeat instance | indexed-repeat(\${q1}, \${r1}, position(..)-1) |
				| | end repeat   |      |                                  |                                              |
			`,
			xml__xpath_match: [
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/q2",
					event: "odk-instance-first-load",
					value:
						"indexed-repeat( /test_name/r1/q1 ,  /test_name/r1 , position(..)-1)",
				}),
				xpq.setvalue({
					path: "h:body/x:group[@ref='/test_name/r1']/x:repeat[@nodeset='/test_name/r1']",
					ref: "/test_name/r1/q2",
					event: "odk-new-repeat",
					value:
						"indexed-repeat( /test_name/r1/q1 ,  /test_name/r1 , position(..)-1)",
				}),
			],
		});
	});

	it("should handle indexed repeat nested repeat relative path exception", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label                                                  | default                                   |
				| | begin_repeat | r1   | Family                                                 |                                           |
				| | integer      | q1   | How many members in this family?                       |                                           |
				| | begin_repeat | r2   | Person                                                 |                                           |
				| | text         | q3   | Enter name                                             |                                           |
				| | text         | q4   | Non-sensible previous name in first family, 2nd person | indexed-repeat(\${q3}, \${r1}, 1, \${r2}, 2) |
				| | end repeat   | r1   |                                                        |                                           |
				| | end repeat   | r2   |                                                        |                                           |
			`,
			xml__xpath_match: [
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/r1/r2/q4",
					event: "odk-instance-first-load",
					value:
						"indexed-repeat( /test_name/r1/r2/q3 ,  /test_name/r1 , 1,  /test_name/r1/r2 , 2)",
				}),
				xpq.setvalue({
					path: "h:body/x:group/x:repeat[@nodeset='/test_name/r1']/x:group/x:repeat[@nodeset='/test_name/r1/r2']",
					ref: "/test_name/r1/r2/q4",
					event: "odk-new-repeat",
					value:
						"indexed-repeat( /test_name/r1/r2/q3 ,  /test_name/r1 , 1,  /test_name/r1/r2 , 2)",
				}),
			],
		});
	});

	it("should handle indexed repeat math expression nested repeat relative path exception", () => {
		assertPyxformXform({
			md: `
				| survey  |                |                |                                  |                                                        |
				|         | type           | name           | label                            | calculation                                            |
				|         | begin_repeat   | family         | Family                           |                                                        |
				|         | integer        | members_number | How many members in this family? |                                                        |
				|         | begin_repeat   | person         | Person                           |                                                        |
				|         | text           | name           | Enter name                       |                                                        |
				|         | integer        | age            | Enter age                        |                                                        |
				|         | text           | prev_name      | Expression label                 | 7 * indexed-repeat(\${age}, \${family}, 1, \${person}, 2) |
				|         | end repeat     |                |                                  |                                                        |
				|         | end repeat     |                |                                  |                                                        |
			`,
			xml__contains: [
				`<bind calculate="7 * indexed-repeat( /test_name/family/person/age ,  /test_name/family , 1,  /test_name/family/person , 2)" nodeset="/test_name/family/person/prev_name" type="string"/>`,
			],
		});
	});

	it("should handle multiple indexed repeat in expression nested repeat relative path exception", () => {
		assertPyxformXform({
			md: `
				| survey  |                |                |                                  |                                                                                                                 |
				|         | type           | name           | label                            | required                                                                                                        |
				|         | begin_repeat   | family         | Family                           |                                                                                                                 |
				|         | integer        | members_number | How many members in this family? |                                                                                                                 |
				|         | begin_repeat   | person         | Person                           |                                                                                                                 |
				|         | text           | name           | Enter name                       |                                                                                                                 |
				|         | integer        | age            | Enter age                        |                                                                                                                 |
				|         | text           | prev_name      | Expression label                 | concat(indexed-repeat(\${name}, \${family}, 1, \${person}, 2), indexed-repeat(\${age}, \${family}, 1, \${person}, 2)) |
				|         | end repeat     |                |                                  |                                                                                                                 |
				|         | end repeat     |                |                                  |                                                                                                                 |
			`,
			xml__contains: [
				`<bind nodeset="/test_name/family/person/prev_name" required="concat(indexed-repeat( /test_name/family/person/name ,  /test_name/family , 1,  /test_name/family/person , 2), indexed-repeat( /test_name/family/person/age ,  /test_name/family , 1,  /test_name/family/person , 2))" type="string"/>`,
			],
		});
	});

	it("should handle mixed variables and indexed repeat in expression text type nested repeat relative path exception", () => {
		assertPyxformXform({
			md: `
				| survey  |                |                |                                  |                                                                                                                 |
				|         | type           | name           | label                            | calculation                                                                                                     |
				|         | begin_repeat   | family         | Family                           |                                                                                                                 |
				|         | integer        | members_number | How many members in this family? |                                                                                                                 |
				|         | begin_repeat   | person         | Person                           |                                                                                                                 |
				|         | text           | name           | Enter name                       |                                                                                                                 |
				|         | integer        | age            | Enter age                        |                                                                                                                 |
				|         | text           | prev_name      | Expression label                 | concat(\${name}, indexed-repeat(\${age}, \${family}, 1, \${person}, 2), \${age})                                     |
				|         | end repeat     |                |                                  |                                                                                                                 |
				|         | end repeat     |                |                                  |                                                                                                                 |
			`,
			xml__contains: [
				`<bind calculate="concat( ../name , indexed-repeat( /test_name/family/person/age ,  /test_name/family , 1,  /test_name/family/person , 2),  ../age )" nodeset="/test_name/family/person/prev_name" type="string"/>`,
			],
		});
	});

	it("should handle mixed variables and indexed repeat in expression integer type nested repeat relative path exception", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label                 | default                                                     |
				| | begin_group  | g1   |                       |                                                             |
				| | begin_repeat | r1   |                       |                                                             |
				| | integer      | q1   | Repeating group entry |                                                             |
				| | text         | q2   | Position              |                                                             |
				| | integer      | q3   | Systolic pressure     |                                                             |
				| | integer      | q4   | Diastolic pressure    | if(\${q1} = 1, '',  indexed-repeat(\${q4}, \${r1}, \${q1} - 1)) |
				| | end_repeat   | r1   |                       |                                                             |
				| | end_group    | g1   |                       |                                                             |
			`,
			xml__xpath_match: [
				xpq.setvalue({
					path: "h:head/x:model",
					ref: "/test_name/g1/r1/q4",
					event: "odk-instance-first-load",
					value:
						"if( ../q1  = 1, '', indexed-repeat( /test_name/g1/r1/q4 ,  /test_name/g1/r1 ,  ../q1  - 1))",
				}),
				xpq.setvalue({
					path: "h:body/x:group/x:group/x:repeat[@nodeset='/test_name/g1/r1']",
					ref: "/test_name/g1/r1/q4",
					event: "odk-new-repeat",
					value:
						"if( ../q1  = 1, '', indexed-repeat( /test_name/g1/r1/q4 ,  /test_name/g1/r1 ,  ../q1  - 1))",
				}),
			],
		});
	});

	it("should handle indexed repeat math expression with double variable in nested repeat relative path exception", () => {
		assertPyxformXform({
			md: `
				| survey  |                |                |                                  |                                                             |
				|         | type           | name           | label                            | relevant                                                    |
				|         | begin_repeat   | family         | Family                           |                                                             |
				|         | integer        | members_number | How many members in this family? |                                                             |
				|         | begin_repeat   | person         | Person                           |                                                             |
				|         | text           | name           | Enter name                       |                                                             |
				|         | integer        | age            | Enter age                        |                                                             |
				|         | text           | prev_name      | Expression label                 | \${age} > indexed-repeat(\${age}, \${family}, 1, \${person}, 2) |
				|         | end repeat     |                |                                  |                                                             |
				|         | end repeat     |                |                                  |                                                             |
			`,
			xml__contains: [
				`<bind nodeset="/test_name/family/person/prev_name" relevant=" ../age  &gt; indexed-repeat( /test_name/family/person/age ,  /test_name/family , 1,  /test_name/family/person , 2)" type="string"/>`,
			],
		});
	});

	it("should handle repeat using select with reference path in predicate uses current", () => {
		assertPyxformXform({
			md: `
				| survey |                 |              |                                                |               |                                                             |
				|        | type            | name         | label                                          | choice_filter | calculation                                                 |
				|        | begin repeat    | item-repeat  | Item                                           |               |                                                             |
				|        | calculate       | item-counter |                                                |               | position(..)                                                |
				|        | calculate       | item         |                                                |               | instance('item')/root/item[itemindex=\${item-counter}]/label |
				|        | begin group     | item-info    | Item info                                      |               |                                                             |
				|        | note            | item-note    | All the following questions are about \${item}. |               |                                                             |
				|        | select one item | stock-item   | Do you stock this item?                        | true()        |                                                             |
				|        | end group       | item-info    |                                                |               |                                                             |
				|        | end repeat      |              |                                                |               |                                                             |
				| choices |           |                  |                   |           |
				|         | list_name | name             | label             | itemindex |
				|         | item      | gasoline-regular | Gasoline, Regular | 1         |
				|         | item      | gasoline-premium | Gasoline, Premium | 2         |
				|         | item      | gasoline-diesel  | Gasoline, Diesel  | 3         |
			`,
			xml__contains: [
				`<bind calculate="instance('item')/root/item[itemindex= current()/../item-counter ]/label" nodeset="/test_name/item-repeat/item" type="string"/>`,
			],
		});
	});

	it("should handle repeat using select uses current with reference path in predicate and instance is not first expression", () => {
		assertPyxformXform({
			md: `
				| survey |                 |              |                                                |               |                                                                               |
				|        | type            | name         | label                                          | choice_filter | calculation                                                                   |
				|        | begin repeat    | item-repeat  | Item                                           |               |                                                                               |
				|        | calculate       | item-counter |                                                |               | position(..)                                                                  |
				|        | calculate       | item         |                                                |               | \${item-counter} + instance('item')/root/item[itemindex=\${item-counter}]/label |
				|        | begin group     | item-info    | Item info                                      |               |                                                                               |
				|        | note            | item-note    | All the following questions are about \${item}. |               |                                                                               |
				|        | select one item | stock-item   | Do you stock this item?                        | true()        |                                                                               |
				|        | end group       | item-info    |                                                |               |                                                                               |
				|        | end repeat      |              |                                                |               |                                                                               |
				| choices |           |                  |                   |           |
				|         | list_name | name             | label             | itemindex |
				|         | item      | gasoline-regular | Gasoline, Regular | 1         |
				|         | item      | gasoline-premium | Gasoline, Premium | 2         |
				|         | item      | gasoline-diesel  | Gasoline, Diesel  | 3         |
			`,
			xml__contains: [
				`<bind calculate=" ../item-counter  + instance('item')/root/item[itemindex= current()/../item-counter ]/label" nodeset="/test_name/item-repeat/item" type="string"/>`,
			],
		});
	});

	it("should handle repeat and group with reference path in predicate uses current", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                                 |
				|        | type         | name  | label | calculation                                     |
				|        | xml-external | item  |       |                                                 |
				|        | begin repeat | rep3  |       |                                                 |
				|        | calculate    | pos3  |       | position(..)                                    |
				|        | begin group  | grp3  |       |                                                 |
				|        | text         | txt3  | Enter |                                                 |
				|        | calculate    | item3 |       | instance('item')/root/item[index=\${pos3}]/label |
				|        | end group    |       |       |                                                 |
				|        | end repeat   |       |       |                                                 |
			`,
			xml__contains: [
				`<bind calculate="instance('item')/root/item[index= current()/../../pos3 ]/label" nodeset="/test_name/rep3/grp3/item3" type="string"/>`,
			],
		});
	});

	it("should handle repeat with reference path in predicate uses current", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                                                 |
				|        | type         | name  | label | calculation                                                     |
				|        | xml-external | item  |       |                                                                 |
				|        | calculate    | pos1  |       | position(..)                                                    |
				|        | begin repeat | rep5  |       |                                                                 |
				|        | calculate    | pos5  |       | position(..)                                                    |
				|        | calculate    | item5 |       | instance('item')/root/item[index=\${pos5} and \${pos1} = 1]/label |
				|        | end repeat   |       |       |                                                                 |
			`,
			xml__contains: [
				`<bind calculate="instance('item')/root/item[index= current()/../pos5  and  /test_name/pos1  = 1]/label" nodeset="/test_name/rep5/item5" type="string"/>`,
			],
		});
	});

	it("should handle repeat with reference path with spaces in predicate uses current", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                                                   |
				|        | type         | name  | label | calculation                                                       |
				|        | xml-external | item  |       |                                                                   |
				|        | calculate    | pos1  |       | position(..)                                                      |
				|        | begin repeat | rep5  |       |                                                                   |
				|        | calculate    | pos5  |       | position(..)                                                      |
				|        | calculate    | item5 |       | instance('item')/root/item[index= \${pos5} and \${pos1} = 1]/label  |
				|        | calculate    | item6 |       | instance('item')/root/item[index =\${pos5} and \${pos1} = 1]/label  |
				|        | calculate    | item7 |       | instance('item')/root/item[index = \${pos5} and \${pos1} = 1]/label |
				|        | end repeat   |       |       |                                                                   |
			`,
			xml__contains: [
				`<bind calculate="instance('item')/root/item[index=  current()/../pos5  and  /test_name/pos1  = 1]/label" nodeset="/test_name/rep5/item5" type="string"/>`,
				`<bind calculate="instance('item')/root/item[index = current()/../pos5  and  /test_name/pos1  = 1]/label" nodeset="/test_name/rep5/item6" type="string"/>`,
				`<bind calculate="instance('item')/root/item[index =  current()/../pos5  and  /test_name/pos1  = 1]/label" nodeset="/test_name/rep5/item7" type="string"/>`,
			],
		});
	});

	it("should handle repeat with reference path in a method with spaces in predicate uses current", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                                                           |
				|        | type         | name  | label | calculation                                                               |
				|        | xml-external | item  |       |                                                                           |
				|        | calculate    | pos1  |       | position(..)                                                              |
				|        | begin repeat | rep5  |       |                                                                           |
				|        | calculate    | pos5  |       | position(..)                                                              |
				|        | calculate    | item5 |       | instance('item')/root/item[index=number(1+ \${pos5}) and \${pos1} = 1]/label |
				|        | end repeat   |       |       |                                                                           |
			`,
			xml__contains: [
				`<bind calculate="instance('item')/root/item[index=number(1+  current()/../pos5 ) and  /test_name/pos1  = 1]/label" nodeset="/test_name/rep5/item5" type="string"/>`,
			],
		});
	});

	it("should handle repeat with reference path with spaces in predicate with parenthesis uses current", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                                                   |
				|        | type         | name  | label | calculation                                                       |
				|        | xml-external | item  |       |                                                                   |
				|        | calculate    | pos1  |       | position(..)                                                      |
				|        | begin repeat | rep5  |       |                                                                   |
				|        | calculate    | pos5  |       | position(..)                                                      |
				|        | calculate    | item5 |       | instance('item')/root/item[index = \${pos5} and \${pos1} = 1]/label |
				|        | end repeat   |       |       |                                                                   |
			`,
			xml__contains: [
				`<bind calculate="instance('item')/root/item[index =  current()/../pos5  and  /test_name/pos1  = 1]/label" nodeset="/test_name/rep5/item5" type="string"/>`,
			],
		});
	});

	it("should not use current for relative path expansion if reference path is predicate but not in a repeat", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                                 |
				|        | type         | name  | label | calculation                                     |
				|        | xml-external | item  |       |                                                 |
				|        | calculate    | pos1  |       | position(..)                                    |
				|        | calculate    | item1 |       | instance('item')/root/item[index=\${pos1}]/label |
			`,
			xml__contains: [
				`<bind calculate="instance('item')/root/item[index= /test_name/pos1 ]/label" nodeset="/test_name/item1" type="string"/>`,
			],
		});
	});

	it("should not use current for relative path expansion if reference path is predicate but not part of primary instance", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                   |
				|        | type         | name  | label | calculation                       |
				|        | xml-external | item  |       |                                   |
				|        | begin repeat | rep1  |       |                                   |
				|        | calculate    | pos2  |       | 1                                 |
				|        | calculate    | item2 |       | \${rep1}[number(\${pos2})]/label    |
				|        | end repeat   |       |       |                                   |
			`,
			xml__contains: [
				`<bind calculate=" /test_name/rep1 [number( ../pos2 )]/label" nodeset="/test_name/rep1/item2" type="string"/>`,
			],
		});
	});

	it("should handle repeat with reference path in multiple predicate uses current", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                                                       |
				|        | type         | name  | label | calculation                                                           |
				|        | xml-external | item  |       |                                                                       |
				|        | begin repeat | rep5  |       |                                                                       |
				|        | calculate    | pos5  |       | position(..)                                                          |
				|        | calculate    | pos6  |       | position(..)                                                          |
				|        | calculate    | item5 |       | instance('item')/root/item[index = \${pos5}][position()=\${pos6}]/label |
				|        | end repeat   |       |       |                                                                       |
			`,
			xml__contains: [
				`<bind calculate="instance('item')/root/item[index =  current()/../pos5 ][position()= current()/../pos6 ]/label" nodeset="/test_name/rep5/item5" type="string"/>`,
			],
		});
	});

	it("should handle repeat with reference path in multiple complex predicate uses current", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                                                                                       |
				|        | type         | name  | label | calculation                                                                                           |
				|        | xml-external | item  |       |                                                                                                       |
				|        | calculate    | pos1  |       | position(..)                                                                                          |
				|        | begin repeat | rep5  |       |                                                                                                       |
				|        | calculate    | pos5  |       | position(..)                                                                                          |
				|        | calculate    | pos6  |       | position(..)                                                                                          |
				|        | calculate    | item5 |       | instance('item')/root/item[index =\${pos5} and selected('1 2 3 4', \${pos1})][position()=\${pos6}]/label |
				|        | end repeat   |       |       |                                                                                                       |
			`,
			xml__contains: [
				`<bind calculate="instance('item')/root/item[index = current()/../pos5  and selected('1 2 3 4',  /test_name/pos1 )][position()= current()/../pos6 ]/label" nodeset="/test_name/rep5/item5" type="string"/>`,
			],
		});
	});

	it("should handle repeat with reference path after instance in predicate uses current", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |       |                                                                                                |
				|        | type         | name  | label | calculation                                                                                    |
				|        | xml-external | item  |       |                                                                                                |
				|        | begin repeat | rep5  |       |                                                                                                |
				|        | calculate    | pos5  |       | position(..)                                                                                   |
				|        | calculate    | item5 |       | concat(instance('item')/root/item[index =\${pos5}]/label, /test_name[position()=\${pos5}]/text) |
				|        | end repeat   |       |       |                                                                                                |
			`,
			xml__contains: [
				`<bind calculate="concat(instance('item')/root/item[index = current()/../pos5 ]/label, /test_name[position()= current()/../pos5 ]/text)" nodeset="/test_name/rep5/item5" type="string"/>`,
			],
		});
	});

	it("should handle repeat with reference path after instance not in predicate not using current", () => {
		assertPyxformXform({
			md: `
				| survey |              |       |            |                                                                       |
				|        | type         | name  | label      | calculation                                                           |
				|        | xml-external | item  |            |                                                                       |
				|        | begin repeat | rep5  |            |                                                                       |
				|        | calculate    | pos5  |            | position(..)                                                          |
				|        | calculate    | item5 |            | concat(instance('item')/root/item[index =\${pos5}]/label, \${pos5} + 1) |
				|        | end repeat   |       |            |                                                                       |
			`,
			xml__contains: [
				`<bind calculate="concat(instance('item')/root/item[index = current()/../pos5 ]/label,  ../pos5  + 1)" nodeset="/test_name/rep5/item5" type="string"/>`,
			],
		});
	});

	// Skipped: Slow performance test. Un-skip to run as needed.
	it.skip("should check performance of relative reference", () => {
		// This is a performance benchmark test. It generates forms with many questions
		// and measures conversion time. Not suitable for regular test runs.
		// See test_check_performance__relative_reference in test_repeat.py for details.
	});

	it("should handle calculation using node from nested repeat has relative reference", () => {
		assertPyxformXform({
			md: `
				| survey |
				|        | type         | name | label  | calculation |
				|        | begin repeat | a    | a      |             |
				|        | begin repeat | r1t  | r1t    |             |
				|        | integer      | t    | target |             |
				|        | end repeat   | r1t  |        |             |
				|        | note         | s    | source | sum(\${t})   |
				|        | end repeat   | a    |        |             |
			`,
			xml__xpath_match: [
				`
				/h:html/h:head/x:model/x:bind[
				  @nodeset = '/test_name/a/s'
				  and @calculate = 'sum( ../r1t/t )'
				]
				`,
			],
		});
	});

	it("should handle repeat adding template and instance", () => {
		assertPyxformXform({
			md: `
				| survey |              |          |           |
				|        | type         | name     | label     |
				|        | text         | aa       | Text AA   |
				|        | begin repeat | section  | Section   |
				|        | text         | a        | Text A    |
				|        | text         | b        | Text B    |
				|        | text         | c        | Text C    |
				|        | note         | d        | Note D    |
				|        | end repeat   |          |           |
				|        |              |          |           |
				|        | begin repeat | repeat_a | Section A |
				|        | begin repeat | repeat_b | Section B |
				|        | text         | e        | Text E    |
				|        | begin repeat | repeat_c | Section C |
				|        | text         | f        | Text F    |
				|        | end repeat   |          |           |
				|        | end repeat   |          |           |
				|        | text         | g        | Text G    |
				|        | begin repeat | repeat_d | Section D |
				|        | note         | h        | Note H    |
				|        | end repeat   |          |           |
				|        | note         | i        | Note I    |
				|        | end repeat   |          |           |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:section[@jr:template='']",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:section[not(@jr:template)]",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:repeat_a[@jr:template='']",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:repeat_a[not(@jr:template)]",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:repeat_a/x:repeat_b[@jr:template='']",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:repeat_a/x:repeat_b[not(@jr:template)]",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:repeat_a/x:repeat_b/x:repeat_c[@jr:template='']",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:repeat_a/x:repeat_b/x:repeat_c[not(@jr:template)]",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:repeat_a/x:repeat_d[@jr:template='']",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:repeat_a/x:repeat_d[not(@jr:template)]",
			],
		});
	});

	it("should handle repeat adding template and instance with group", () => {
		assertPyxformXform({
			md: `
				| survey |              |          |           |
				|        | type         | name     | label     |
				|        | text         | aa       | Text AA   |
				|        | begin repeat | section  | Section   |
				|        | text         | a        | Text A    |
				|        | text         | b        | Text B    |
				|        | text         | c        | Text C    |
				|        | note         | d        | Note D    |
				|        | end repeat   |          |           |
				|        |              |          |           |
				|        | begin group  | group_a  | Group A   |
				|        | begin repeat | repeat_a | Section A |
				|        | begin repeat | repeat_b | Section B |
				|        | text         | e        | Text E    |
				|        | begin group  | group_b  | Group B   |
				|        | text         | f        | Text F    |
				|        | text         | g        | Text G    |
				|        | note         | h        | Note H    |
				|        | end group    |          |           |
				|        | note         | i        | Note I    |
				|        | end repeat   |          |           |
				|        | end repeat   |          |           |
				|        | end group    |          |           |
			`,
			xml__xpath_match: [
				"/h:html/h:head/x:model/x:instance/x:test_name/x:section[@jr:template='']",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:section[not(@jr:template)]",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:group_a/x:repeat_a[@jr:template='']",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:group_a/x:repeat_a[not(@jr:template)]",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:group_a/x:repeat_a/x:repeat_b[@jr:template='']",
				"/h:html/h:head/x:model/x:instance/x:test_name/x:group_a/x:repeat_a/x:repeat_b[not(@jr:template)]",
			],
		});
	});
});

describe("TestRepeatParsing", () => {
	it("should find that a single unique repeat name is ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that repeats with unique names in the same context is ok", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin repeat | r2   | R2    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a repeat name can be the same (CI) as another repeat in a different context", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin group  | g1   | G1    |
				| | begin repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | end group    |      |       |
				| | begin repeat | R1   | R2    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
			`,
			warnings_count: 0,
		});
	});

	it("should find that a repeat name can be the same (CI) as the survey root", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | DATA | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
			`,
			name: "data",
			warnings_count: 0,
		});
	});

	it("should find that a duplicate repeat name in same context in survey raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin repeat | r1   | R1    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
			`,
			errored: true,
			error__contains: ["[row : 5]", "r1"],
		});
	});

	it("should find that a duplicate repeat name in same context in group raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin group  | g1   | G1    |
				| | begin repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin repeat | r1   | R1    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
				| | end group    |      |       |
			`,
			errored: true,
			error__contains: ["[row : 6]", "r1"],
		});
	});

	it("should find that a duplicate repeat name in same context in repeat raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | begin repeat | r2   | R2    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin repeat | r2   | R2    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
				| | end repeat   |      |       |
			`,
			errored: true,
			error__contains: ["[row : 6]", "r2"],
		});
	});

	it("should find that a duplicate repeat name (CI) in same context in survey raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin repeat | R1   | R1    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
			`,
			warnings__contains: ["[row : 5]", "R1"],
		});
	});

	it("should find that a duplicate repeat name (CI) in same context in group raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin group  | g1   | G1    |
				| | begin repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin repeat | R1   | R1    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
				| | end group    |      |       |
			`,
			warnings__contains: ["[row : 6]", "R1"],
		});
	});

	it("should find that a duplicate repeat name (CI) in same context in repeat raises a warning", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | begin repeat | r2   | R2    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | begin repeat | R2   | R2    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
				| | end repeat   |      |       |
			`,
			warnings__contains: ["[row : 6]", "R2"],
		});
	});

	it("should find that a repeat name same as the survey root raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | data | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
			`,
			name: "data",
			errored: true,
			error__contains: ["[row : 2]", "data"],
		});
	});

	it("should find that a duplicate repeat name in different context in group raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin group  | g1   | G1    |
				| | begin repeat | r1   | R1    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | end group    |      |       |
				| | begin repeat | r1   | R1    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
			`,
			errored: true,
			error__contains: ["[row : 7]", "r1"],
		});
	});

	it("should find that a duplicate repeat name in different context in repeat raises an error", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | begin repeat | r2   | R2    |
				| | text         | q1   | Q1    |
				| | end repeat   |      |       |
				| | end repeat   |      |       |
				| | begin repeat | r2   | R2    |
				| | text         | q2   | Q2    |
				| | end repeat   |      |       |
			`,
			errored: true,
			error__contains: ["[row : 7]", "r2"],
		});
	});

	it("should not raise an error for an empty repeat with no questions", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label |
				| | begin repeat | r1   | R1    |
				| | end repeat   |      |       |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[@ref='/test_name/r1']
				  /x:repeat[
				    @nodeset='/test_name/r1'
				    and not(./x:input)
				  ]
				`,
			],
		});
	});

	it("should not raise an error for an empty repeat with no question controls", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | calculation |
				| | begin repeat | r1   | R1    |             |
				| | text         | r1   |       | 0 + 0       |
				| | end repeat   |      |       |             |
			`,
			warnings_count: 0,
			xml__xpath_match: [
				`
				/h:html/h:body/x:group[@ref='/test_name/r1']
				  /x:repeat[
				    @nodeset='/test_name/r1'
				    and not(./x:input)
				  ]
				`,
			],
		});
	});

	it("should warn about unlabeled repeat", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name      | label   |
				| | begin_repeat | my-repeat |         |
				| | text         | my-text   | my-text |
				| | end_repeat   |           |         |
			`,
			warnings_count: 1,
			warnings__contains: ["[row : 2] Repeat has no label"],
		});
	});

	it("should warn about unlabeled repeat alternate syntax", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name      | label::English (en) |
				| | begin_repeat | my-repeat |                     |
				| | text         | my-text   | my-text             |
				| | end_repeat   |           |                     |
			`,
			warnings_count: 1,
			warnings__contains: ["[row : 2] Repeat has no label"],
		});
	});

	it("should warn about unlabeled repeat fieldlist", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name      | label   | appearance |
				| | begin_repeat | my-repeat |         | field-list |
				| | text         | my-text   | my-text |            |
				| | end_repeat   |           |         |            |
			`,
			warnings_count: 1,
			warnings__contains: ["[row : 2] Repeat has no label"],
		});
	});

	it("should warn about unlabeled repeat fieldlist alternate syntax", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name      | label::English (en) | appearance |
				| | begin_repeat | my-repeat |                     | field-list |
				| | text         | my-text   | my-text             |            |
				| | end_repeat   |           |                     |            |
			`,
			warnings_count: 1,
			warnings__contains: ["[row : 2] Repeat has no label"],
		});
	});
});

describe("TestRepeatCount", () => {
	it("should handle single reference with generated element same name", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name     | label | repeat_count |
				| | integer      | q1_count | Q1    |              |
				| | begin repeat | r1       | R1    | \${q1_count}  |
				| | text         | q2       | Q2    |              |
				| | end repeat   |          |       |              |
			`,
			xml__xpath_match: [
				xpq.model_instance_item("q1_count"),
				xpq.model_instance_bind("q1_count", "int"),
				xpq.body_control("q1_count", "input"),
				`
				/h:html/h:head/x:model/x:instance/x:test_name[not(./x:r1_count)]
				`,
				`
				/h:html/h:head/x:model[not(./x:bind[@nodeset='/test_name/r1_count'])]
				`,
				`
				/h:html/h:body/x:group[@ref='/test_name/r1']/x:repeat[
				  @nodeset='/test_name/r1'
				  and @jr:count=' /test_name/q1_count '
				]
				`,
			],
		});
	});

	it("should handle single reference with generated element different name", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | repeat_count |
				| | integer      | q1   | Q1    |              |
				| | begin repeat | r1   | R1    | \${q1}        |
				| | text         | q2   | Q2    |              |
				| | end repeat   |      |       |              |
			`,
			xml__xpath_match: [
				xpq.model_instance_item("q1"),
				xpq.model_instance_bind("q1", "int"),
				xpq.body_control("q1", "input"),
				`
				/h:html/h:head/x:model/x:instance/x:test_name[not(./x:r1_count)]
				`,
				`
				/h:html/h:head/x:model[not(./x:bind[@nodeset='/test_name/r1_count'])]
				`,
				`
				/h:html/h:body/x:group[@ref='/test_name/r1']/x:repeat[
				  @nodeset='/test_name/r1'
				  and @jr:count=' /test_name/q1 '
				]
				`,
			],
		});
	});

	it("should error on expression with generated element same name", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name     | label | repeat_count                |
				| | select_multiple l1 | r1_count | Q1    |                             |
				| | begin_repeat       | r1       | R1    | count-selected(\${r1_count}) |
				| | text               | q2       | Q2    |                             |
				| | end_repeat         |          |       |                             |

				| choices |
				| | list_name | name | label |
				| | l1        | c1   | C1    |
				| | l1        | c2   | C2    |
			`,
			errored: true,
			error__contains: ["r1_count"],
		});
	});

	it("should handle expression with generated element different name", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label | repeat_count          |
				| | select_multiple l1 | q1   | Q1    |                       |
				| | begin_repeat       | r1   | R1    | count-selected(\${q1}) |
				| | text               | q2   | Q2    |                       |
				| | end_repeat         |      |       |                       |

				| choices |
				| | list_name | name | label |
				| | l1        | c1   | C1    |
				| | l1        | c2   | C2    |
			`,
			xml__xpath_match: [
				xpq.model_instance_item("r1_count"),
				xpq.model_instance_bind("r1_count", "string"),
				xpq.model_instance_bind_attr(
					"r1_count",
					"calculate",
					"count-selected( /test_name/q1 )",
				),
				xpq.model_instance_bind_attr("r1_count", "readonly", "true()"),
				`
				/h:html/h:body/x:group[@ref='/test_name/r1']/x:repeat[
				  @nodeset='/test_name/r1'
				  and @jr:count=' /test_name/r1_count '
				]
				`,
			],
		});
	});

	it("should error on manual xpath with generated element same name", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name     | label | repeat_count                          |
				| | select_multiple l1 | r1_count | Q1    |                                       |
				| | begin_repeat       | r1       | R1    | count-selected( /test_name/r1_count ) |
				| | text               | q2       | Q2    |                                       |
				| | end_repeat         |          |       |                                       |

				| choices |
				| | list_name | name | label |
				| | l1        | c1   | C1    |
				| | l1        | c2   | C2    |
			`,
			errored: true,
			error__contains: ["r1_count"],
		});
	});

	it("should handle manual xpath with generated element different name", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type               | name | label | repeat_count                    |
				| | select_multiple l1 | q1   | Q1    |                                 |
				| | begin_repeat       | r1   | R1    | count-selected( /test_name/q1 ) |
				| | text               | q2   | Q2    |                                 |
				| | end_repeat         |      |       |                                 |

				| choices |
				| | list_name | name | label |
				| | l1        | c1   | C1    |
				| | l1        | c2   | C2    |
			`,
			xml__xpath_match: [
				xpq.model_instance_item("r1_count"),
				xpq.model_instance_bind("r1_count", "string"),
				xpq.model_instance_bind_attr(
					"r1_count",
					"calculate",
					"count-selected( /test_name/q1 )",
				),
				xpq.model_instance_bind_attr("r1_count", "readonly", "true()"),
				`
				/h:html/h:body/x:group[@ref='/test_name/r1']/x:repeat[
				  @nodeset='/test_name/r1'
				  and @jr:count=' /test_name/r1_count '
				]
				`,
			],
		});
	});

	it("should error on constant integer with generated element same name", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name     | label | repeat_count |
				| | integer      | r1_count | Q1    |              |
				| | begin_repeat | r1       | R1    | 2            |
				| | text         | q2       | Q2    |              |
				| | end_repeat   |          |       |              |
			`,
			errored: true,
			error__contains: ["r1_count"],
		});
	});

	it("should handle constant integer with generated element different name", () => {
		assertPyxformXform({
			md: `
				| survey |
				| | type         | name | label | repeat_count |
				| | integer      | q1   | Q1    |              |
				| | begin_repeat | r1   | R1    | 2            |
				| | text         | q2   | Q2    |              |
				| | end_repeat   |      |       |              |
			`,
			xml__xpath_match: [
				xpq.model_instance_item("r1_count"),
				xpq.model_instance_bind("r1_count", "string"),
				xpq.model_instance_bind_attr("r1_count", "calculate", "2"),
				xpq.model_instance_bind_attr("r1_count", "readonly", "true()"),
				`
				/h:html/h:body/x:group[@ref='/test_name/r1']/x:repeat[
				  @nodeset='/test_name/r1'
				  and @jr:count=' /test_name/r1_count '
				]
				`,
			],
		});
	});
});
