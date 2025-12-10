"""
Objects used in Statements to build Queries.
"""

import uuid
from typing import Literal, Optional, TypeAlias

RelationType: TypeAlias = Literal["MANY-TO-ONE", "ONE-TO-ONE", "MANY-TO-MANY"]
OrderType: TypeAlias = Literal["ASC", "DESC"]

class Neo4jEntity:
    """
    Represents an abstraction over any type of entity we refer to in a query.
    """
    id: int # its unique ID
    label: str # the label the entity corresponds to in the database
    variable: str # the variable to which this node is referred to throughout the query
    bound: bool = False # whether or not it is bound, which determines how it is printed
    # we figure out if nodes need their variables once all statements have been created

    def __init__(self, variable, label):
        self.label = label
        self.variable = variable
        self.id = uuid.uuid1().int

    def print(self) -> str:
        return self.variable

    def __eq__(self, other):
        return self.id == other.id

    def as_attribute(self, attr: str) -> str:
        return f"{self.variable}.{attr} AS {attr}"


class Neo4jNode(Neo4jEntity):
    """
    Represents nodes within the database.
    """
    def __init__(self, variable, label):
        super().__init__(variable, label)

    def print(self) -> str:
        # prints like (n:Node) if bound and (:Node) if not
        return f"({self.variable if self.bound else ''}:{self.label})"


class Neo4jAlias(Neo4jEntity):
    """
    Represents aliases, entities created with aggregation or 
    AS statements within WITH statements
    """
    init: str 
    
    def __init__(self, variable, init):
        self.init = init
        super().__init__(variable, variable)

    def print(self, init: Optional[bool] = False):
        # init is used to print each alias as action(original_variable) AS alias
        # the first time it appears in the query within a WITH statement
        if init:
            return self.init
        else:
            return self.variable


class Neo4jRelation(Neo4jEntity):
    """
    Represents relations within the database.
    """
    nodeA: Neo4jNode
    nodeB: Neo4jNode
    relation_type: RelationType  # (ONE-TO-ONE, MANY-TO-ONE, MANY-TO-MANY)

    def __init__(
        self,
        variable: str,
        nodeA: Neo4jNode,
        label: str,
        nodeB: Neo4jNode,
        relation_type: RelationType,
    ):
        self.nodeA = nodeA
        self.nodeB = nodeB
        self.relation_type = relation_type
        super().__init__(variable, label)

    def get_neighbor(self, node: Neo4jNode):
        # gets node on the other side of node
        if node == self.nodeA:
            return self.nodeB
        else:
            return self.nodeA

    def nodes(self):
        return self.nodeA, self.nodeB

    def print(self) -> str:
        # prints [r:relation] if bound else [:relation]
        return f"[{self.variable if self.bound else ''}:{self.label}]"
