#
# © 2025. Triad National Security, LLC. All rights reserved.
# This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
#
import functools
from typing import Callable, Dict, List

from .neo4j_types import Neo4jEntity


def get_entity_ids(statement_list):
    return functools.reduce(
        lambda a, b: a + b, map(lambda a: a.entityIDs, statement_list)
    )


class Statement:
    entityIDs: List[int]
    render_func: Callable

    def __init__(self, entities, render_func):
        ids = []
        if isinstance(entities, Neo4jEntity):
            ids.append(entities.id)
        else:
            for entity in entities:
                ids.append(entity.id)

        self.entityIDs = ids
        self.render_func = render_func

    def render(self, entities: Dict[int, Neo4jEntity], *_):
        entity_list = list(map(lambda id: entities[id], self.entityIDs))
        return self.render_func(entity_list)


class MatchStatement(Statement):
    def __init__(self, entities, render_func):
        super().__init__(entities, render_func)

    def render(self, entities: Dict[int, Neo4jEntity], statements, idx):
        entity_list = list(map(lambda id: entities[id], self.entityIDs))
        following = statements[idx + 1 :]

        if len(following) > 0:
            nextIDs = get_entity_ids(following)
            for e in entity_list:
                if e.id in nextIDs:
                    e.bound = True

        return self.render_func(entity_list)


class WithStatement(Statement):
    def __init__(self, entities, render_func):
        super().__init__(entities, render_func)

    def render(self, entities: Dict[int, Neo4jEntity], statements, idx):
        entity_list = list(map(lambda id: entities[id], self.entityIDs))
        next = []

        def isNotWith(s):
            return not isinstance(s, WithStatement)

        previous = statements[:idx]
        following = statements[idx + 1 :]

        previous = list(filter(lambda s: isNotWith(s), previous))
        following = list(filter(lambda s: isNotWith(s), following))

        prevIDs = []
        next = []
        if len(previous) > 0:
            prevIDs = get_entity_ids(previous)
            prevIDs = list(
                set([x for x in prevIDs if x not in self.entityIDs])
            )

        if len(following) > 0:
            nextIDs = get_entity_ids(following)
            nextIDs = list(
                set(
                    [
                        x
                        for x in nextIDs
                        if x not in self.entityIDs and x in prevIDs
                    ]
                )
            )
            next = list(map(lambda id: entities[id], nextIDs))
        return self.render_func(entity_list, next)
