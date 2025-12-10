import re
from typing import Any, Dict

import numpy as np


def sanitize_neo4j_string(string):
    """
    Converts a string to one that is safe for neo4j to use in attribute / label names.
    Based on https://neo4j.com/docs/cypher-manual/current/syntax/naming/

    :param string: the string to convert

    :returns: a safe string for neo4j to consume
    """
    return re.sub("[^A-Za-z0-9]+", "_", string)


def stringify(value) -> str:
    """
    If passed a string, returns it encased within double quotes.
    """
    if isinstance(value, str) and value[0] != "$":
        value = f"'{value}'"
    return str(value)


def numpy_converter(d):
    """
    Converts numpy objects to JSON serializable types.

    :param d: The object to convert to a JSON serializable type.
    """
    if isinstance(d, np.integer):
        return int(d)
    elif isinstance(d, np.floating):
        return float(d)
    elif isinstance(d, np.ndarray):
        d = d.tolist()
        return list(map(lambda e: numpy_converter(e), d))
    else:
        return d


def unpack_ovito(data) -> Dict[Any, Any]:
    """
    Converts an OVITO representation of a state to a Python dict.
    :param data: The OVITO representation to convert to a dictionary.
    """
    unpacked = {}
    unpacked["cell"] = numpy_converter(data.cell[...])

    for p in data.particles.keys():
        arr = []
        for d in data.particles[p]:
            arr.append(numpy_converter(d))
        unpacked[p.lower().replace(" ", "_")] = arr

    bond_data = {}
    bonds = data.particles.bonds
    if bonds is not None:
        for p in bonds.keys():
            arr = []
            for d in bonds[p]:
                arr.append(numpy_converter(d))
            bond_data[p.lower().replace(" ", "_")] = arr

    unpacked["bonds"] = bond_data

    return unpacked


def adaptive_zca_whitening(X, threshold, epsilon=1e-5):
    """Applies an adaptive ZCA whitening to X.
    Args:
        X: Matrix to reduce
        threshold: the minimum value a singular value (column) should have to be kept.
        epsilon: Noise to add to singular values to avoid division by zero.

    Returns:
        The whitened matrix.
    """
    sigma = np.cov(X, rowvar=False)
    U, S, V = np.linalg.svd(sigma)

    k = 0
    for v in S:
        if v > threshold:
            k += 1
    print(f"{k} features kept.")

    top_U = U[:, :k]
    top_S = S[:k]

    red_zca = np.dot(np.diag(1.0 / np.sqrt(top_S + epsilon)), top_U.T)
    return X @ red_zca.T
