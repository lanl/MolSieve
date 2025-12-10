import pytest

from neomd.queries.querybuilder import Neo4jQueryBuilder


def test_add_to_schema():
    qb = Neo4jQueryBuilder()

    qb.add_node("Metadata")
    qb.add_relation("State", "nano_pt", "State", "ONE-TO-ONE")
    qb.add_relation("Atom", "PART_OF", "State", "MANY-TO-ONE")

    key_list = qb.schema.keys()

    assert "Metadata" in key_list
    assert "State" in key_list
    assert "Atom" in key_list
    assert "nano_pt" in key_list
    assert "PART_OF" in key_list


def test_match_node(qb):
    qb.match_node("State")
    q = qb.build()
    assert q.text == """MATCH (:State);"""


def test_match_node_bound(qb):
    s = qb.match_node("State")
    qb.where_in(s, "foo", ["bar", "baz"])
    q = qb.build()

    v = s.variable
    assert q.text == f"MATCH ({v}:State)\nWHERE {v}.foo IN ['bar', 'baz'];"


def test_match_missing_node(qb):
    with pytest.raises(KeyError):
        qb.match_node("Bogus")


def test_match_node_with_wrong_type(qb):
    with pytest.raises(ValueError):
        qb.match_node("PART_OF")


def test_match_node_with(qb):
    qb.match_node_with("State", "id", 4)
    q = qb.build()
    assert q.text == """MATCH (:State { id:4 });"""


def test_match_relation(qb):
    qb.match_relation("nano_pt")
    q = qb.build()
    assert q.text == "MATCH (:State)-[:nano_pt]->(:State);"


def test_match_relation_varA(qb):
    n = qb.match_node("State")
    qb.match_relation("nano_pt", varA=n)
    q = qb.build()

    v = n.variable
    assert q.text == f"MATCH ({v}:State)\nMATCH ({v})-[:nano_pt]->(:State);"


def test_match_relation_varB(qb):
    n = qb.match_node("State")
    qb.match_relation("nano_pt", varB=n)
    q = qb.build()

    v = n.variable
    assert q.text == f"MATCH ({v}:State)\nMATCH (:State)-[:nano_pt]->({v});"


def test_with(qb):
    n = qb.match_node("State")
    qb.with_statement()
    qb.return_entities(n)
    q = qb.build()

    v = n.variable
    assert q.text == f"""MATCH ({v}:State)\nWITH {v}\nRETURN {v};"""


def test_with_collect(qb):
    a, _, _ = qb.match_relation("PART_OF")
    w = qb.with_statement(qb.collect(a))
    qb.return_entities(*w)
    q = qb.build()
    assert (
        q.text
        == """MATCH (a:Atom)-[:PART_OF]->(:State)\nWITH collect(DISTINCT a) AS a_list\nRETURN a_list;"""
    )


def test_with_count(qb):
    a, _, _ = qb.match_relation("PART_OF")
    w = qb.with_statement(qb.count(a))
    qb.return_entities(*w)
    q = qb.build()
    assert (
        q.text
        == """MATCH (a:Atom)-[:PART_OF]->(:State)\nWITH count(DISTINCT a) AS a_count\nRETURN a_count;"""
    )


def test_with_alias(qb):
    a, _, _ = qb.match_relation("PART_OF")
    w = qb.with_statement(qb.alias(a, "foo"))
    qb.return_entities(*w)
    q = qb.build()
    assert (
        q.text
        == """MATCH (a:Atom)-[:PART_OF]->(:State)\nWITH a.foo AS a_foo\nRETURN a_foo;"""
    )


def test_with_alias_and_binding(qb):
    a, _, s = qb.match_relation("PART_OF")
    w = qb.with_statement(qb.alias(a, "foo"))
    qb.return_entities(*w, s)
    q = qb.build()

    assert (
        q.text
        == """MATCH (a:Atom)-[:PART_OF]->(s111:State)\nWITH a.foo AS a_foo,s111\nRETURN a_foo,s111;"""
    )


def test_return_entities(qb):
    s = qb.match_node_with("State", "id", 4)
    qb.return_entities(s)
    q = qb.build()

    v = s.variable
    assert q.text == f"""MATCH ({v}:State {{ id:4 }})\nRETURN {v};"""


def test_return_entities_no_entities(qb):
    with pytest.raises(ValueError):
        qb.return_entities()


def test_return_attributes(qb):
    s = qb.match_node("State")
    qb.return_attributes(s, ["foo", "bar"])
    q = qb.build()

    v = s.variable
    assert (
        q.text
        == f"""MATCH ({v}:State)\nRETURN {v}.foo AS foo, {v}.bar AS bar;"""
    )


def test_return_attributes_no_attributes(qb):
    s = qb.match_node("State")
    with pytest.raises(ValueError):
        qb.return_attributes(s, [])


def test_where_in(qb):
    s = qb.match_node("State")
    qb.where_in(s, "id", [1, 2, 3])
    q = qb.build()

    v = s.variable
    assert q.text == f"""MATCH ({v}:State)\nWHERE {v}.id IN [1, 2, 3];"""


def test_where_between(qb):
    s = qb.match_node("State")
    qb.where_between(s, "id", 1, 3)
    q = qb.build()

    v = s.variable
    assert (
        q.text == f"""MATCH ({v}:State)\nWHERE {v}.id >= 1 AND {v}.id <= 3;"""
    )


def test_set_value(qb):
    s = qb.match_node("State")
    qb.set(qb.set_value(s, "foo", 5))

    q = qb.build()

    v = s.variable
    assert q.text == f"""MATCH ({v}:State)\nSET {v}.foo = 5;"""


def test_set_value_alias(qb):
    a, r, _ = qb.match_relation("PART_OF")
    w = qb.with_statement(qb.collect(r))
    qb.set(qb.set_value_to_alias(a, "foo", w[0]))

    q = qb.build()

    assert (
        q.text
        == f"""MATCH (a:Atom)-[p:PART_OF]->(:State)\nWITH collect(DISTINCT p) AS p_list,a\nSET a.foo = p_list;"""
    )


@pytest.mark.usefixtures("driver")
def test_infer_from_db(driver):
    qb = Neo4jQueryBuilder.infer_db_structure(driver)
    print(qb.schema)
