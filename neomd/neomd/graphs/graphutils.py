from multiprocessing import Pool

import networkx as nx
import numpy as np
import scipy.sparse as sp
from ase import neighborlist
from netrd.distance import distributional_nbd
from scipy.integrate import quad
from scipy.linalg import eigh
from scipy.sparse.csgraph import laplacian
from scipy.special import erf
from tqdm import tqdm
from typeguard import typechecked
from scipy.linalg import subspace_angles
from neomd.graphs import StateGraph


@typechecked
def calculate_connectivity_difference(s1: StateGraph, s2: StateGraph, threshold: float):
    """
    Calculates how many atoms "moved" between two state graphs.

    :param s1: State graph 1
    :param s2: State graph 2
    :param threshold: Distance in Angstroms that determines if
    a bond has changed.
    :return: A set of atom indices that have changed between
    two state graphs.
    """

    diff = calculate_rel_bond_delta(s1, s2)
    np.fill_diagonal(diff, 0)

    # ReLu activation function for thresholding
    def fthresh(e):
        return max(0, e - threshold)

    vfthresh = np.vectorize(fthresh)
    t_diff = vfthresh(diff)

    thresh = np.where(t_diff > 0)
    x_list, y_list = thresh

    moved = set()
    for i, j in zip(x_list, y_list):
        moved.add(i)
        moved.add(j)
    return moved


@typechecked
def calculate_bond_delta(s1: StateGraph, s2: StateGraph):
    s1dm = s1.get_distance_matrix()
    s2dm = s2.get_distance_matrix()

    return np.absolute(s2dm - s1dm)


@typechecked
def calculate_rel_bond_delta(s1: StateGraph, s2: StateGraph):
    """
    Calculates relative bond delta between two state graphs,
    expressed as a percentage.
    """

    if s1.size() != s2.size():
        raise ValueError(
            f"""Graphs must be the same size!
            S1 size: {s1.size()} / S2 size: {s2.size()}."""
        )

    s1dm = s1.get_distance_matrix()
    s2dm = s2.get_distance_matrix()

    delta = np.absolute(s2dm - s1dm)
    avg = (s1dm + s2dm) / 2.0

    np.seterr(divide="ignore", invalid="ignore")
    return delta / avg


# adapted from netrd - added ability to get weighted adjacency matrix
def pseudo_hashimoto(graph, weight=None):
    """
    Return the pseudo-Hashimoto matrix.

    The pseudo Hashimoto matrix of a graph is the block matrix defined as
    B' = [0  D-I]
         [-I  A ]

    Where D is the degree-diagonal matrix, I is the identity matrix and A
    is the adjacency matrix.  The eigenvalues of B' are always eigenvalues
    of B, the non-backtracking or Hashimoto matrix.

    Parameters
    ----------

    graph (nx.Graph): A NetworkX graph object.

    Returns
    -------

    A sparse matrix in csr format.

    NOTE: duplicated from "nbd.py" to avoid excessive imports.

    """
    # Note: the rows of nx.adjacency_matrix(graph) are in the same order as
    # the list returned by graph.nodes().
    degrees = graph.degree(weight=weight)
    degrees = sp.diags([degrees[n] for n in graph.nodes()])
    adj = nx.adjacency_matrix(graph, weight=weight)
    ident = sp.eye(graph.order())
    pseudo = sp.bmat([[None, degrees - ident], [-ident, adj]])
    return pseudo.asformat("csr")


def reduced_hashimoto(graph, shave=True, sparse=True, weight=None):
    if shave:
        graph = distributional_nbd.shave_graph(graph)
        if len(graph) == 0:
            # We can provide a workaround for this case, however it is best
            # that it is brought to the attention of the user.
            raise NotImplementedError(
                "Graph two-core is empty: non-backtracking methods unsuitable."
            )

    B = pseudo_hashimoto(graph, weight)

    if not sparse:
        B = B.todense()

    return B


@typechecked
def calc_spectrum(g: nx.Graph, weight):
    h = reduced_hashimoto(g, shave=True, sparse=False, weight=weight)
    e = distributional_nbd.nb_eigenvalues(h, k=None)
    d = distributional_nbd.spectral_distribution(e)
    return d


def im_spectrum(g, weight=None, hwhm=0.08):
    adj = nx.to_numpy_array(g, weight=weight)
    n = adj.shape[0]
    laplace = laplacian(adj, normed=False)
    spec = np.sqrt(np.abs(eigh(laplace)[0][1:]))
    norm = (n - 1) * np.pi / 2  # - np.sum(np.arctan(-spec / hwhm))
    return lambda w: np.sum(hwhm / ((w - spec) ** 2 + hwhm**2)) / norm


def im_distance(density1, density2):
    func = lambda w: (density1(w) - density2(w)) ** 2
    return np.sqrt(quad(func, -np.inf, np.inf, limit=100)[0])


def euclidean_spectra_comp(density1, density2, a=0, b=2):
    integrand = lambda x: (density1(x) - density2(x)) ** 2
    return np.sqrt(quad(integrand, a, b)[0])


def adjacency_to_oriented_incidence(m):
    """
    Constructs an oriented incidence matrix from a given adjacency matrix.

    Args:
        adj_matrix (list of list of int): The adjacency matrix of the graph.
                                         For a directed graph, adj_matrix[i][j] = 1
                                         if there's an edge from node i to node j,
                                         0 otherwise.

    Returns:
        numpy.ndarray: The oriented incidence matrix. Rows represent nodes,
                       columns represent edges.
    """
    num_nodes = m.shape[0]

    # Identify all directed edges and assign an arbitrary order to them
    edges = np.argwhere(m)
    num_edges = edges.shape[0]

    # Initialize the oriented incidence matrix with zeros
    oriented_incidence_matrix = np.zeros((num_nodes, num_edges), dtype=int)
    edge_idxs = np.arange(num_edges)
    oriented_incidence_matrix[edges[:, 0], edge_idxs] = -1
    oriented_incidence_matrix[edges[:, 1], edge_idxs] = 1

    """
    for edge_idx, (u, v) in enumerate(edges): 
        oriented incidence_matrix[u, edge_idx] = -1 
        oriented_incidence_matrix[v, edge_idx] = 1
    """

    return oriented_incidence_matrix, edges


def ASE_to_laplacian(atoms, weights, **kwargs):
    A = ASE_to_adjacency(atoms)
    return wlaplacian(A, weights, **kwargs)


def ASE_to_adjacency(atoms):
    nl = neighborlist.build_neighbor_list(
        atoms,
        neighborlist.natural_cutoffs(atoms),
        self_interaction=False,
        bothways=True,
    )
    A = neighborlist.get_connectivity_matrix(nl.nl, sparse=False)
    return A


def coulomb(atoms, rcut=3.2):
    A = atoms.get_all_distances(mic=True)
    np.fill_diagonal(A, 1)
    A = 1 / A - 1 / rcut
    A[A < 0] = 0
    np.fill_diagonal(A, 0.5)

    return A


# calculate normed laplacian from adjacency matrix
def wlaplacian(A, weights, norm=False):
    B, edges = adjacency_to_oriented_incidence(A)
    W = np.diag(weights[edges[:, 0], edges[:, 1]])
    if norm:
        D = np.diag(np.sum(A, axis=0))
        Dp = np.sqrt(np.linalg.pinv(D))
        Dp = np.reciprocal(Dp, where=Dp != 0)
        return Dp @ B @ W @ B.T @ Dp
    return B @ W @ B.T


# https://netrd.readthedocs.io/en/latest/_modules/netrd/distance/laplacian_spectral_method.html#LaplacianSpectral
def _create_continuous_spectrum(eigenvalues, kernel, hwhm=0.011775, a=0, b=2):
    """Convert a set of eigenvalues into a normalized density function

    The discrete spectrum (sum of dirac delta) is convolved with a kernel and
    renormalized.

    Parameters
    ----------

    eigenvalues (array): list of eigenvalues.

    kernel (str): kernel to be used for the convolution with the discrete
    spectrum.

    hwhm (float): half-width at half-maximum for the kernel.

    a,b (float): lower and upper bounds of the support for the eigenvalues.

    Returns
    -------

    density (function): one argument function for the continuous spectral
    density.

    """
    # define density and repartition function for each eigenvalue
    # if normal
    std = hwhm / 1.1775
    f = lambda x, xp: np.exp(-((x - xp) ** 2) / (2 * std**2)) / np.sqrt(
        2 * np.pi * std**2
    )
    F = lambda x, xp: (1 + erf((x - xp) / (np.sqrt(2) * std))) / 2

    if kernel == "lorentzian":
        f = lambda x, xp: hwhm / (np.pi * (hwhm**2 + (x - xp) ** 2))
        F = lambda x, xp: np.arctan((x - xp) / hwhm) / np.pi + 1 / 2

    # compute normalization factor and define density function
    Z = np.sum(F(b, eigenvalues) - F(a, eigenvalues))
    return lambda x: np.sum(f(x, eigenvalues)) / Z


def euc_spec_dist_wrapper(args):
    """Helper function to unpack arguments for spectral_distance."""
    i, j, di, dj, kwargs = args
    d1 = _create_continuous_spectrum(di, "lorentzian")
    d2 = _create_continuous_spectrum(dj, "lorentzian")
    return i, j, euclidean_spectra_comp(d1, d2, **kwargs)


def subspace_angle_wrapper(args):
    i, j, di, dj, kwargs = args
    # _, s, _ = np.linalg.svd(di.T @ dj)
    a = np.linalg.norm(subspace_angles(di, dj))
    # a = np.linalg.norm(np.arccos(np.clip(s, -1.0, 1.0)))
    return (
        i,
        j,
        a,  # np.arccos(np.clip(s, -1.0, 1.0))),
    )  # )
