"""
This class allows the user to easily build common neo4j queries
without knowing the databases' schema or how to use neo4j.
"""

from typing import Any, Dict, List, Optional

from typeguard import typechecked

from .core import Neo4jQueryBuilderCore
from .neo4j_types import OrderType
from .query import Query

# TODO: get rid of generate_ everywhere
# TODO: use map projection when getting atoms
# https://neo4j.com/docs/cypher-manual/current/syntax/maps/


class Neo4jQueryBuilder(Neo4jQueryBuilderCore):
    @typechecked
    def generate_update_entity(
        self,
        attributes: Dict[str, Any],
        label: str,
        match_on: str,
    ):
        """
        Generates a template query that updates a node.

        :param attributes: dict of {attribute_name: attribute_value}.
        :param label: label of the entity you're updating
        :param match_on: attribute you want to match on
        :param returnNode: Whether or not to return the node after
        being updated.

        :return Query: Query to use for updating nodes.
        """

        self.options = ["DF"]

        n = self.match_node_with(label, match_on, f"${match_on}")
        attribute_fragments = []
        for attr in attributes:
            attribute_fragments.append(self.set_value(n, attr, f"${attr}"))
        self.set(*attribute_fragments)

        return self.build()

    # TODO: these should all be just query fragments that you put together
    @typechecked
    def get_states(
        self,
        id_list: List[int],
        include_atoms: Optional[bool] = False,
        attribute_list: Optional[List[str]] = None,
        order_by: Optional[str] = "internal_id",
    ):
        """
        Get nodes from the database corresponding to the list of ids
        supplied.

        :param label: The label of the node to get a list of.
        :param idList: The IDs of the nodes that will be returned by
        this query.
        :param include_atoms: TODO
        :param attribute_list: The attributes to retrieve for each node.
        :param order_by: If supplied, orders the atoms by the given attribute.

        :returns: Neo4j Query object.
        """

        self.options = ["NODE", "DF"]
        s1 = self.match_node("State")
        self.where_in(s1, "id", id_list)

        # realistically is never anything but include atoms
        if include_atoms:
            self.__include_atoms(s1, order_by)
        else:
            if not attribute_list:
                self.return_entities(s1)
            else:
                self.return_attributes(s1, attribute_list)

        return self.build()

    # TODO: document optional, add support for retrieving attributes
    # for multiple different entities

    @typechecked
    def generate_get_path(
        self,
        start: int,
        end: int,
        relation: str,
        match_on: str = "timestep",
        include_atoms: bool = True,
        order_by: OrderType = "ASC",
        optional: bool = False,
    ):
        """
        Given a start and end timestep, finds all the states between.

        :param start: Timestep the path starts on
        :param end: Timestep the path ends on
        :param match_on: The attribute to match on.
        :param include_atoms: Whether or not to include Atoms objects.
        :param order_by: How the results should be ordered.
        """

        s1, r, _ = self.match_relation(relation, optional=optional)
        self.where_between(r, match_on, start, end)

        if include_atoms:
            self.__include_atoms(s1)
        else:
            self.return_entities(s1)
        self.order_by(r, match_on, order_by)

        return self.build()

    def __include_atoms(self, s, order_by="internal_id"):
        a, _, _ = self.match_relation("PART_OF", varB=s)
        self.with_statement()
        self.order_by(a, order_by)
        w = self.with_statement(self.collect(a))
        self.options.append("ASE")
        self.return_entities(s, *w)

    @typechecked
    def generate_get_occurrences(
        self,
        run: str,
    ) -> Query:
        """
        Query that gets the number of times a node occured in a trajectory
        and saves it in a metadata node.

        :param run: Trajectory to calculate occurrences on.
        """

        # TODO: split this to be even simpler, have metadata write
        # call calculate
        q = f"""MATCH (s:{run})-[r:{run}]->(:{run})
        WITH count(DISTINCT r) AS r_count, s
        MATCH (m:Metadata {{ run: '{run}'}})
        WITH r_count, s, m
        SET s.{run}_occurrences = r_count, m.{run}_occurrences = True
        RETURN s.{run}_occurrences AS occurrences;
        """

        return Query(q, [])

    @typechecked
    def transition_matrix(self, relation: str, occurrenceString: str) -> Query:
        """
        Given a relation string and occurrence string,
        gets the relation specified as
        (from)-[relation]->(to),
        and returns a transition matrix containing the probabilities
        of "from" transitioning to "to" as number of relations /
        from.occurrences.

        :param relation : The relation to use.
        :param occurrenceString: The attribute that is used as the count
        for the "from" node.
        """
        s, r, s2 = self.match_relation(relation)
        w = self.with_statement(
            self.alias(s, "id", "s_id"),
            self.alias(s2, "id", "s2_id"),
            self.count(r, "transition_count"),
            self.alias(s, occurrenceString, "occurrences"),
        )
        obj = self.create_object(
            id="s2_id", p="toFloat(transition_count) / occurrences"
        )
        w2 = self.with_statement(self.custom_collect(obj, "transitions"))
        self.return_entities(w[0], *w2)

        return self.build()

    @typechecked
    def get_potential_file(self, run: str) -> Query:
        """
        Gets the potential file and its contents from the database.

        :param run: The name of the trajectory to retrieve the potential
        file for.
        :return: A neo4j query object.
        """
        m = self.match_node_with("Metadata", "run", run)
        self.return_attributes(m, ["potentialFileName", "potentialFileRaw"])

        return self.build()
