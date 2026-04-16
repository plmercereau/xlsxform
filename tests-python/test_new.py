"""
Standalone Python tests validating pyxform parity and XLSForm appearance coverage.
Run with: tests-python/.venv/bin/pytest tests-python/test_new.py -v
Requires: Python 3.10+, pyxform installed from local submodule.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pyxform"))

from tests.pyxform_test_case import PyxformTestCase


class TestPyxformParity(PyxformTestCase):
    """Category A: Tests adapted from pyxform that can use assertPyxformXform."""

    def test_e2e_row_with_no_column_value(self):
        """Adapted from test_xls2xform_convert__e2e_row_with_no_column_value.
        Verifies that a form with empty cells in rows converts correctly."""
        self.assertPyxformXform(
            md="""
            | survey |        |        |        |         |
            |        | type   | name   | label  | hint    |
            |        | text   | state  | State  |         |
            |        | text   | city   | City   | A hint  |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/state']",
                "/h:html/h:body/x:input[@ref='/test_name/city']",
            ],
        )

    def test_xpath_dict_idempotency(self):
        """Adapted from test_xpath_dict_initialised_once.
        Verifies that converting a form with ${ref} variables produces valid XML."""
        self.assertPyxformXform(
            md="""
            | survey |      |      |                          |
            |        | type | name | label                    |
            |        | text | q1   | Your first name?         |
            |        | text | q2   | ${q1}, what is your last name? |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1']",
                "/h:html/h:body/x:input[@ref='/test_name/q2']",
            ],
        )


class TestAppearances(PyxformTestCase):
    """Category C: XLSForm appearance types with zero test coverage."""

    def test_likert__select_one(self):
        self.assertPyxformXform(
            md="""
            | survey  |                   |      |       |            |
            |         | type              | name | label | appearance |
            |         | select_one colors | q1   | Q1    | likert     |
            | choices |           |       |       |
            |         | list_name | name  | label |
            |         | colors    | red   | Red   |
            |         | colors    | blue  | Blue  |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:select1[@ref='/test_name/q1' and @appearance='likert']",
            ],
        )

    def test_likert__with_translations(self):
        self.assertPyxformXform(
            md="""
            | survey  |                   |      |              |                 |            |
            |         | type              | name | label::en    | label::fr       | appearance |
            |         | select_one colors | q1   | Pick color   | Choisir couleur | likert     |
            | choices |           |       |          |            |
            |         | list_name | name  | label::en | label::fr |
            |         | colors    | red   | Red       | Rouge     |
            |         | colors    | blue  | Blue      | Bleu      |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:select1[@ref='/test_name/q1' and @appearance='likert']",
                "/h:html/h:head/x:model/x:itext/x:translation[@lang='en']",
                "/h:html/h:head/x:model/x:itext/x:translation[@lang='fr']",
            ],
        )

    def test_multiline__text(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |            |
            |        | type | name | label | appearance |
            |        | text | q1   | Q1    | multiline  |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='multiline']",
            ],
        )

    def test_numbers__text(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |            |
            |        | type | name | label | appearance |
            |        | text | q1   | Q1    | numbers    |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='numbers']",
            ],
        )

    def test_thousands_sep__integer(self):
        self.assertPyxformXform(
            md="""
            | survey |         |      |       |              |
            |        | type    | name | label | appearance   |
            |        | integer | q1   | Q1    | thousands-sep |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='thousands-sep']",
            ],
        )

    def test_thousands_sep__decimal(self):
        self.assertPyxformXform(
            md="""
            | survey |         |      |       |              |
            |        | type    | name | label | appearance   |
            |        | decimal | q1   | Q1    | thousands-sep |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='thousands-sep']",
            ],
        )

    def test_masked__text(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |            |
            |        | type | name | label | appearance |
            |        | text | q1   | Q1    | masked     |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='masked']",
            ],
        )

    def test_url__text(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |            |
            |        | type | name | label | appearance |
            |        | text | q1   | Q1    | url        |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='url']",
            ],
        )

    def test_calendar__ethiopian(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |            |
            |        | type | name | label | appearance |
            |        | date | q1   | Q1    | ethiopian  |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='ethiopian']",
            ],
        )

    def test_calendar__coptic(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |            |
            |        | type | name | label | appearance |
            |        | date | q1   | Q1    | coptic     |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='coptic']",
            ],
        )

    def test_calendar__islamic(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |            |
            |        | type | name | label | appearance |
            |        | date | q1   | Q1    | islamic    |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='islamic']",
            ],
        )

    def test_calendar__bikram_sambat(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |               |
            |        | type | name | label | appearance    |
            |        | date | q1   | Q1    | bikram-sambat |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='bikram-sambat']",
            ],
        )

    def test_calendar__myanmar(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |            |
            |        | type | name | label | appearance |
            |        | date | q1   | Q1    | myanmar    |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='myanmar']",
            ],
        )

    def test_combined__multiline_numbers(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |                    |
            |        | type | name | label | appearance         |
            |        | text | q1   | Q1    | multiline numbers  |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='multiline numbers']",
            ],
        )

    def test_no_calendar__date(self):
        self.assertPyxformXform(
            md="""
            | survey |      |      |       |             |
            |        | type | name | label | appearance  |
            |        | date | q1   | Q1    | no-calendar |
            """,
            xml__xpath_match=[
                "/h:html/h:body/x:input[@ref='/test_name/q1' and @appearance='no-calendar']",
            ],
        )
