def test_get_states_with_atoms(qb):
    q = qb.get_states([1, 2, 3], True)
    assert (
        q.text
        == """MATCH (s111:State)\nWHERE s111.id IN [1, 2, 3]\nMATCH (a:Atom)-[:PART_OF]->(s111)\nWITH s111,a\nORDER BY a.internal_id ASC\nWITH collect(DISTINCT a) AS a_list,s111\nRETURN s111,a_list;"""
    )


def test_get_states_with_attributes(qb):
    q = qb.get_states([1, 2, 3], attributeList=["foo", "bar", "id"])
    assert (
        q.text
        == """MATCH (s111:State)\nWHERE s111.id IN [1, 2, 3]\nRETURN s111.foo AS foo, s111.bar AS bar, s111.id AS id;"""
    )


# also somehow stochastic - WITH doesn't always return things in the same order
def test_generate_path(qb):
    q = qb.generate_get_path(0, 100, "nano_pt", "timestep")
    assert (
        q.text
        == """MATCH (s:State)-[n:nano_pt]->(:State)\nWHERE n.timestep >= 0 AND n.timestep <= 100\nMATCH (a:Atom)-[:PART_OF]->(s)\nWITH a,n,s\nORDER BY a.internal_id ASC\nWITH collect(DISTINCT a) AS a_list,s,n\nRETURN s,a_list\nORDER BY n.timestep ASC;"""
    )


def test_get_occurrences(qb):
    q = qb.generate_get_occurrences("nano_pt")
    assert (
        q.text
        == """MATCH (s:State)-[n:nano_pt]->(:State)\nWITH count(DISTINCT n) AS n_count,s\nMATCH (m:Metadata { run:'nano_pt' })\nWITH s,m\nSET s.occurrences = n_count,m.occurrences = True\nRETURN s.occurrences AS occurrences;"""
    )


def test_transition_matrix(qb):
    q = qb.transition_matrix("nano_pt", "nano_pt_occurrences")
    assert (
        q.text
        == """MATCH (s:State)-[n:nano_pt]->(s1:State)\nWITH s.id AS s_id,s1.id AS s2_id,count(DISTINCT n) AS transition_count,s.nano_pt_occurrences AS occurrences\nWITH collect({id: s2_id, p: toFloat(transition_count) / occurrences}) AS transitions\nRETURN s_id,transitions;"""
    )


def test_generate_entity(qb):
    q = qb.generate_update_entity(
        {"prop1": 2, "prop2": 5412345}, "State", "id"
    )
    assert (
        q.text
        == """MATCH (s111:State { id:$id })\nSET s111.prop1 = $prop1,s111.prop2 = $prop2;"""
    )


def test_get_potential_file(qb):
    q = qb.get_potential_file("nano_pt")
    assert (
        q.text
        == "MATCH (m:Metadata { run:'nano_pt' })\nRETURN m.potentialFileName AS potentialFileName, m.potentialFileRaw AS potentialFileRaw;"
    )
