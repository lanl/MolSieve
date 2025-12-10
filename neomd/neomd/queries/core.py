#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
from functools import partial
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeAlias, Union

from typeguard import typechecked

from neomd.utils import stringify

from .neo4j_types import (
    Neo4jAlias,
    Neo4jEntity,
    Neo4jNode,
    Neo4jRelation,
    OrderType,
    RelationType,
)
from .query import Query
from .statement import MatchStatement, Statement, WithStatement

# TODO: schema should support multiple labels for entities


class Neo4jQueryBuilderCore:
    RelationTuple: TypeAlias = Tuple[str, str, str, RelationType]
    schema: Dict[str, Neo4jEntity]  # the objects in the database
    entities: List[Neo4jEntity]  # entities in the current statement
    options: List[str]  # options passed to final Query object
    statements: List[Statement]  # list of statements for the current query
    id_to_entity: Dict[int, Neo4jEntity]  # id to entity dictionary

    @typechecked
    def __init__(
        self,
        relations: Optional[List[RelationTuple]] = [],
        nodes: Optional[List[str]] = [],
    ):
        """
        Creates a new QueryBuilder object with the schema defined by the user.

        :param relations: List of tuples of [FROM_NODE, NAME_OF_RELATION, TO_NODE, TYPE_OF_RELATION (see RelationType for example)]
        :param nodes: List of strings corresponding to node labels in the database.
        """
        self.schema = {}
        self.entities = []
        self.options = []
        self.statements = []
        self.id_to_entity = {}

        for relation in relations:
            node_a, relation_name, node_b, relation_type = relation
            self.add_relation(node_a, relation_name, node_b, relation_type)

        for node in nodes:
            self.add_node(node)

        # always a part of the database
        # [("Atom", "PART_OF", "State", "MANY-TO-ONE")], ["State"]
        if "Metadata" not in nodes:
            self.add_node("Metadata")

    @classmethod
    def infer_db_structure(cls, driver):
        """
        Probes the Neo4j server and builds a query builder based on the contents of the database.
        :param driver: The Neo4j connection to use

        :returns: Query builder object with an inferred schema
        """
        runs = []
        with driver.session() as session:
            result = session.run("MATCH (m:Metadata) RETURN DISTINCT m.run;")
            for r in result.values():
                for record in r:
                    runs.append(record)

        relations = [("Atom", "PART_OF", "State", "MANY-TO-ONE")]
        for r in runs:
            relations.append(("State", r, "State", "ONE-TO-ONE"))
        qb = cls(
            relations,
            ["Atom", "State", "NEB", "Metadata"],
        )

        return qb

    def clear(self):
        """
        Clears the querybuilder's current state.
        """
        self.entities = []
        self.options = []
        self.statements = []

    @typechecked
    def get_free_var(self, label: str) -> str:
        """
        Checks the currently existing entities in the schema and returns an unused variable label.

        :param label str: The label of the entity being added.
        """
        var = label[0].lower()
        used_vars = map(lambda e: e.variable, self.id_to_entity.values())
        while var in used_vars:
            var += "1"
        return var

    @typechecked
    def add_node(self, label: str) -> Neo4jNode:
        """
        Adds a new node to the schema.

        :param label: Label of the node.
        :return: Neo4jNode object describing that node in the database.
        """
        var = self.get_free_var(label)
        entity = Neo4jNode(var, label)
        self.id_to_entity[entity.id] = entity
        self.schema[label] = entity

        return entity

    @typechecked
    def add_relation(
        self,
        node_a: str,
        relation_name: str,
        node_b: str,
        relation_type: RelationType,
    ) -> Neo4jRelation:
        """
        Adds a new relation to the schema. Note that nodes within the relation
        will be added to the schema with a different variable and ID
        if they already exist. This ensures that it is possible to
        refer to nodes in general as well as nodes within a relation throughout a query.

        :param node_a: Label for the from node.
        :param relation_name: Name of the relation
        :param node_b: Label for the to node.
        :param relation_type RelationType: Type of the relation.

        :return: Neo4jRelation describing the newly created relation.
        """
        nodeA = self.add_node(node_a)
        nodeB = self.add_node(node_b)

        var = self.get_free_var(relation_name)
        entity = Neo4jRelation(var, nodeA, relation_name, nodeB, relation_type)
        self.id_to_entity[entity.id] = entity
        self.schema[relation_name] = entity

        if nodeA.label == nodeB.label:
            self.add_node(node_a)

        return entity

    @typechecked
    def add_alias(self, alias, init_statement) -> Neo4jAlias:
        """
        Adds an alias for a node. Also used when running aggregate queries on nodes such as collect,
        count, etc.

        :param alias: The alias as it will appear in the statement.
        :param init_statement: The statement that will initially be rendered to create the alias.
        :return: A Neo4jAlias object describing the alias.
        """
        node = Neo4jAlias(alias, init_statement)
        self.id_to_entity[node.id] = node
        return node

    def build(self) -> Query:
        """
        Creates a new Query object from all of the statements in the querybuilder.

        :return: Query object.
        """
        statements = []
        for i in range(0, len(self.statements)):
            t = self.statements[i].render(
                self.id_to_entity, self.statements, i
            )
            statements.append(t)

        text = "\n".join(statements)
        text += ";"
        q = Query(text, self.options)

        self.clear()
        return q

    def __add_statement(
        self,
        entities: Union[List[Neo4jEntity], Neo4jEntity],
        render_func: Callable,
    ):
        """
        Internal method to add a Statement to the statements list.

        :param entities: The entities to add to the statement.
        :param render_func: The function that will be run when building the query.
        """
        self.statements.append(Statement(entities, render_func))

    def __with_statement(
        self,
        entities: Union[List[Neo4jEntity], Neo4jEntity],
        render_func: Callable,
    ):
        """
        Internal method to add a WithStatement to the statements list.

        :param entities: The entities to add to the statement.
        :param render_func: The function that will be run when building the query.
        """
        self.statements.append(WithStatement(entities, render_func))

    def __match_statement(
        self,
        entities: Union[List[Neo4jEntity], Neo4jEntity],
        render_func: Callable,
    ):
        """
        Internal method to add a MatchStatement to the statements list.

        :param entities: The entities to add to the statement.
        :param render_func: The function that will be run when building the query.
        """

        self.statements.append(MatchStatement(entities, render_func))

    def return_entities(self, *entities):
        """
        Adds a return statement to the query with the entities requested.
        :raises ValueError: Raised if no entities were specified.
        """

        if len(entities) == 0:
            raise ValueError("Please specify which entities must be returned.")

        def render(entities):
            variables = list(map(lambda e: e.variable, entities))
            return f"RETURN {','.join(variables)}"

        self.__add_statement(entities, render)

    # TODO: make this work for multiple entities
    def return_attributes(
        self, entity: Neo4jEntity, attribute_list: List[str]
    ):
        """
        Adds a return statement to the query that returns every attribute in the attribute_list assigned to the entity.

        :param entity: The entity to return attributes for.
        :param attributeList: List of attributes to return for this entity.
        """
        if len(attribute_list) == 0:
            raise ValueError("Please specify attributes to return.")

        render = (
            lambda entity: f"RETURN {', '.join(map(lambda a: entity[0].as_attribute(a), attribute_list))}"
        )
        self.__add_statement(entity, render)

    # TODO: these should be fragments of WHERE statements
    def where_in(self, entity, attribute, attributeList):
        render = (
            lambda entity: f"WHERE {entity[0].variable}.{attribute} IN {attributeList}"
        )
        self.__add_statement(entity, render)

    def where_between(self, entity, attribute, v1, v2):
        render = (
            lambda entity: f"WHERE {entity[0].variable}.{attribute} >= {v1} AND {entity[0].variable}.{attribute} <= {v2}"
        )
        self.__add_statement(entity, render)

    @typechecked
    def order_by(
        self,
        entity: Neo4jEntity,
        attribute: Optional[str] = None,
        order: OrderType = "ASC",
    ):
        """
        Adds a ORDER BY statement that orders output by the specified entity / attribute.

        :param entity: The entity to order by.
        :param attribute: Optional, but must be provided if entity is not a Neo4jAlias
        :param order: Must be either ASC or DESC.
        """
        useAttribute = "" if attribute is None else f".{attribute}"
        render = (
            lambda entity: f"ORDER BY {entity[0].variable}{useAttribute} {order}"
        )
        self.__add_statement(entity, render)

    # TODO: document optional

    @typechecked
    def match_node(self, label: str, optional: bool = False) -> Neo4jNode:
        """
        Add a match statement for a node based on its label.

        :param label: Label of node to match.

        :raises ValueError: Raised if label does not correspond to a node or does not exist.
        :returns: Neo4jNode according to the label, can be used in further queries.
        """
        node = self.schema[label]
        if isinstance(node, Neo4jNode):
            render = lambda entity: f"MATCH {entity[0].print()}"
            self.__match_statement(node, render)
        else:
            raise ValueError(f"{label} is not a node or does not exist.")
        return node

    @typechecked
    def match_node_with(
        self,
        label: str,
        match_on: str,
        match_on_value: Any,
        optional: bool = False,
    ):
        """
        Adds a match statement for a node based on a value.

        :param label: The label of the node.
        :param match_on: The attribute to match on.
        :param match_on_value: The value to match on.
        :raises ValueError: Raised if label does not correspond to a node or does not exist.

        :returns: Neo4jNode according to the label, can be used in further queries.
        """
        node = self.schema[label]
        if isinstance(node, Neo4jNode):

            def render(entities):
                node = entities[0]
                print_var = node.variable if node.bound else ""
                return f"MATCH ({print_var}:{node.label} {{ {match_on}:{stringify(match_on_value)} }})"

            self.__match_statement(node, render)
        else:
            raise ValueError(f"{label} is not a node or does not exist.")

        return node

    @typechecked
    def match_relation(
        self,
        relation_name: str,
        varA: Optional[Neo4jNode] = None,
        varB: Optional[Neo4jNode] = None,
        optional: bool = False,
    ):
        """
        Matches a relation based on its label.

        :param relation_name: The name of the relation.
        :param varA: If supplied, matches relation to this node instead of nodeA.
        :param varB: If supplied, matches relation to this node instead of nodeB.
        :raises ValueError: Raised if label does not correspond to relation or does not exist.
        """
        relation = self.schema[relation_name]

        if isinstance(relation, Neo4jRelation):
            nodeA = relation.nodeA if varA is None else varA
            nodeB = relation.nodeB if varB is None else varB

            p = (
                lambda e: e.print()
                if e is not varA and e is not varB
                else f"({e.variable})"
            )
            entities = [nodeA, relation, nodeB]

            if not optional:
                render = lambda e: f"MATCH {p(e[0])}-{p(e[1])}->{p(e[2])}"
            else:
                render = (
                    lambda e: f"OPTIONAL MATCH {p(e[0])}-{p(e[1])}->{p(e[2])}"
                )

            self.__match_statement(entities, render)

            return nodeA, relation, nodeB
        else:
            raise ValueError("f{relation_name} is not a relation.")

    def set_value(self, entity: Neo4jEntity, attribute: str, value: Any):
        """
        Used with set to build a SET statement.
        Sets the entity's attribute to the value.

        :param entity: Entity to set value for.
        :param attribute: Attribute to set value for.
        :param value: The value to be set for the entity attribute pair.
        """
        return entity, lambda e: f"{e.variable}.{attribute} = {value}"

    def set_value_to_alias(
        self, entity: Neo4jEntity, attribute: str, alias: Neo4jEntity
    ):
        """
        Used with set to build a SET statement.

        :param entity: Entity to set value for.
        :param attribute: Attribute to set value for.
        :param alias: The alias to set the entity attribute pair to.
        """
        return [
            entity,
            alias,
        ], lambda e: f"{e[0].variable}.{attribute} = {e[1].print()}"

    # render should rely on entities
    def set(self, *args):
        """
        Generates a SET statement from a list of set statement fragments.

        """
        entities = []
        fns = []
        for entity, fn in args:
            if isinstance(entity, list):
                for e in entity:
                    entities.append(e)
            else:
                entities.append(entity)
                fns.append(fn)

        render = lambda b: f"SET {','.join(map(lambda a: a[1](a[0]), args))}"

        self.__add_statement(entities, render)

    # TODO: possibly with, where and set statements operate on statement fragment lists
    def alias(self, entity, attribute, custom_alias=None):
        def c(entity, attribute):
            alias = (
                f"{entity.variable}_{attribute}"
                if custom_alias is None
                else custom_alias
            )
            statement = f"{entity.variable}.{attribute} AS {alias}"
            return alias, statement

        entity.bound = True
        return partial(c, entity, attribute)

    def count(self, entity, custom_alias=None):
        def c(entity):
            alias = (
                f"{entity.variable}_count"
                if custom_alias is None
                else custom_alias
            )
            statement = f"count(DISTINCT {entity.variable}) AS {alias}"
            return alias, statement

        entity.bound = True
        return partial(c, entity)

    def collect(self, entity, custom_alias=None):
        def c(entity):
            alias = (
                f"{entity.variable}_list"
                if custom_alias is None
                else custom_alias
            )
            statement = f"collect(DISTINCT {entity.variable}) AS {alias}"
            return alias, statement

        entity.bound = True
        return partial(c, entity)

    def with_statement(self, *args):
        """
        Generates a WITH statement from WITH statement fragments and the
        variables that are needed in future statements.

        """
        aliases = []
        for fn in args:
            alias, statement = fn()
            aliases.append(self.add_alias(alias, statement))

        def render(entities, next):
            statements = list(map(lambda e: e.print(True), entities))
            variables = list(map(lambda e: e.variable, next))
            return f"WITH {','.join(statements + variables)}"

        self.__with_statement(aliases, render)

        return aliases

    # TODO: clean up
    def create_object(self, **data):
        """
        Creates a Neo4j object to use in queries.

        """
        return f"{data}".replace("'", "")

    def custom_collect(self, statement: str, alias: str):
        """
        Hack to make create_object work.

        :param statement: The object to collect.
        :param alias: Name of the resulting object.
        """

        def c():
            return alias, f"collect({statement}) AS {alias}"

        return partial(c)
