"""Polygon interior sampling utilities (Triangulator and UniformSampler).

WHAT IT DOES
------------
Utility module imported by generate_code_simplified.py.
Provides two strategies for placing navigation nodes inside room polygons:

  Triangulator
      Constrained Delaunay Triangulation (CDT) - subdivides the polygon into
      triangles and places one node at each triangle centroid.  Produces a
      denser, topology-aware mesh suitable for complex room shapes.

  UniformSampler
      Places nodes on a regular grid, keeping only those that fall strictly
      inside the polygon.  Simpler and faster; used when triangulation is
      disabled in GraphBuilderConfig.

NOT meant to be run directly; import it as a module:
    from sampler import Triangulator, UniformSampler

DEPENDENCIES
------------
  pip install shapely triangle numpy scipy
"""

from typing import Any

import numpy as np
import numpy.typing as npt
import triangle as tr
from scipy.spatial import Delaunay
from shapely.geometry import Point, Polygon

# Two triangles sharing an edge for adjacency
ADJACENT_TRIANGLE_COUNT = 2


class Triangulator:
    """CDT of polygons with centroid nodes and adjacency edges."""

    @staticmethod
    def polygon_to_pslg(poly: Polygon) -> dict[str, Any]:
        """Convert a Shapely Polygon to a PSLG (Planar Straight Line Graph).

        Args:
            poly: Shapely Polygon (can have holes).

        Returns:
            Dict with 'vertices' (Nx2), 'segments' (Mx2), and optionally 'holes'.

        """
        vertices_list: list[list[float]] = []
        segments_list: list[list[int]] = []
        vertex_index: dict[tuple[float, float], int] = {}

        def add_ring(coords: list[Any]) -> None:
            if coords[0] == coords[-1]:
                coords = coords[:-1]
            indices: list[int] = []
            for x, y in coords:
                key = (float(x), float(y))
                if key not in vertex_index:
                    vertex_index[key] = len(vertices_list)
                    vertices_list.append([float(x), float(y)])
                indices.append(vertex_index[key])
            n = len(indices)
            for i in range(n):
                i0, i1 = indices[i], indices[(i + 1) % n]
                segments_list.append([i0, i1])

        add_ring(list(poly.exterior.coords))
        holes_list: list[Any] = []
        for interior in poly.interiors:
            add_ring(list(interior.coords))
            holes_list.append(next(iter(interior.representative_point().coords)))

        vertices = np.asarray(vertices_list, dtype=float)
        segments = np.asarray(segments_list, dtype=int)
        holes = np.asarray(holes_list, dtype=float) if holes_list else None

        pslg: dict[str, Any] = {"vertices": vertices, "segments": segments}
        if holes is not None:
            pslg["holes"] = holes
        return pslg

    def sample(
        self,
        poly: Polygon,
        spacing: float,
        max_area: float | None = None,
        min_edge_distance: float | None = None,
    ) -> tuple[npt.NDArray[np.float64], list[tuple[int, int]]]:
        """Run CDT on a polygon; return centroid positions and adjacency edges.

        Args:
            poly: Shapely Polygon to triangulate.
            spacing: Grid/spacing hint (unused; for API compatibility).
            max_area: Maximum triangle area (smaller = denser mesh).
            min_edge_distance: Minimum distance from boundary for nodes.

        Returns:
            centroids: (M, 2) array of node positions.
            adjacency_edges: List of (i, j) edges between adjacent triangles.

        """
        _ = spacing  # API compatibility with UniformSampler.sample
        pslg = self.polygon_to_pslg(poly)
        flags = "pqD"
        if max_area is not None:
            flags += f"a{max_area}"
        t = tr.triangulate(pslg, flags)
        vertices = t["vertices"]
        triangles = t["triangles"]

        valid_triangles = []
        for tri in triangles:
            cx, cy = vertices[tri].mean(axis=0)
            if poly.contains(Point(cx, cy)):
                valid_triangles.append(tri)

        if len(valid_triangles) == 0:
            centroid = poly.centroid
            return np.array([[centroid.x, centroid.y]]), []

        triangles = np.array(valid_triangles)
        centroids = np.array(
            [vertices[tri].mean(axis=0) for tri in triangles],
            dtype=float,
        )

        if min_edge_distance is not None and min_edge_distance > 0:
            return self._filter_by_boundary_distance(
                poly,
                centroids,
                triangles,
                min_edge_distance,
            )

        edge_to_triangles = self._build_edge_to_triangles(triangles)
        adjacency_edges = [
            (i, j)
            for tris in edge_to_triangles.values()
            if len(tris) == ADJACENT_TRIANGLE_COUNT
            for i, j in [tris]
        ]
        return centroids, adjacency_edges

    def _filter_by_boundary_distance(
        self,
        poly: Polygon,
        centroids: npt.NDArray[np.float64],
        triangles: npt.NDArray[np.intp],
        min_edge_distance: float,
    ) -> tuple[npt.NDArray[np.float64], list[tuple[int, int]]]:
        """Filter nodes by min distance to boundary; rebuild adjacency edges."""
        valid_indices = []
        for i, (cx, cy) in enumerate(centroids):
            if Point(cx, cy).distance(poly.exterior) >= min_edge_distance:
                valid_indices.append(i)
        if len(valid_indices) == 0:
            center = poly.centroid
            dists = np.sqrt(
                (centroids[:, 0] - center.x) ** 2
                + (centroids[:, 1] - center.y) ** 2,
            )
            valid_indices = [int(np.argmin(dists))]
        centroids = centroids[valid_indices]
        old_to_new = {old: new for new, old in enumerate(valid_indices)}
        valid_set = set(valid_indices)
        edge_to_triangles = self._build_edge_to_triangles(triangles)
        adjacency_edges = []
        for tris in edge_to_triangles.values():
            if len(tris) == ADJACENT_TRIANGLE_COUNT:
                i, j = tris
                if i in valid_set and j in valid_set:
                    adjacency_edges.append(
                        (old_to_new[i], old_to_new[j]),
                    )
        return centroids, adjacency_edges

    @staticmethod
    def _build_edge_to_triangles(
        triangles: npt.NDArray[np.intp],
    ) -> dict[tuple[int, int], list[int]]:
        """Map each vertex edge to the triangle indices that contain it."""
        edge_to_triangles: dict[tuple[int, int], list[int]] = {}
        for ti, tri in enumerate(triangles):
            for k in range(3):
                a, b = tri[k], tri[(k + 1) % 3]
                ia, ib = int(a), int(b)
                e = (min(ia, ib), max(ia, ib))
                edge_to_triangles.setdefault(e, []).append(ti)
        return edge_to_triangles


class UniformSampler:
    """Uniform grid-based sampling inside polygons with roughly equal spacing."""

    @staticmethod
    def _grid_points_in_bbox(
        minx: float,
        miny: float,
        maxx: float,
        maxy: float,
        spacing: float,
    ) -> npt.NDArray[np.float64]:
        """Generate 2D grid points in a bounding box with given spacing.

        Grid is aligned so points are spaced by `spacing`; the first point
        is at (minx, miny) and the grid extends to cover the box.

        Args:
            minx: Left bound of bounding box.
            miny: Bottom bound of bounding box.
            maxx: Right bound of bounding box.
            maxy: Top bound of bounding box.
            spacing: Distance between adjacent grid points.

        Returns:
            (N, 2) array of grid coordinates.

        """
        if spacing <= 0:
            msg = "spacing must be positive"
            raise ValueError(msg)
        nx = max(1, int(np.ceil((maxx - minx) / spacing)) + 1)
        ny = max(1, int(np.ceil((maxy - miny) / spacing)) + 1)
        xs = np.linspace(minx, maxx, nx)
        ys = np.linspace(miny, maxy, ny)
        xx, yy = np.meshgrid(xs, ys)
        return np.column_stack([xx.ravel(), yy.ravel()])

    @staticmethod
    def _delaunay_edges(points: npt.NDArray[np.float64]) -> list[tuple[int, int]]:
        """Build adjacency edges from Delaunay triangulation of points.

        Returns list of (i, j) with i < j for each edge in the triangulation.
        """
        if len(points) < ADJACENT_TRIANGLE_COUNT:
            return []
        if len(points) == ADJACENT_TRIANGLE_COUNT:
            return [(0, 1)]
        tri = Delaunay(points)
        edge_set = set()
        for simplex in tri.simplices:
            for i in range(3):
                a, b = simplex[i], simplex[(i + 1) % 3]
                edge_set.add((min(a, b), max(a, b)))
        return sorted(edge_set)

    def sample(
        self,
        poly: Polygon,
        spacing: float,
        max_area: float | None = None,
        min_edge_distance: float | None = None,
    ) -> tuple[npt.NDArray[np.float64], list[tuple[int, int]]]:
        """Sample points uniformly inside a polygon with roughly equal spacing.

        Uses a regular grid with the given spacing; points outside the polygon
        are discarded. Optionally filters by minimum distance from the boundary.

        Args:
            poly: Shapely Polygon to sample (can have holes).
            spacing: Desired distance between neighboring grid points.
            max_area: Unused; for API compatibility with Triangulator.
            min_edge_distance: Minimum distance from boundary for sampled points.

        Returns:
            points: (N, 2) array of sample positions.
            adjacency_edges: List of (i, j) edges from Delaunay graph of points.

        """
        _ = max_area  # API compatibility with Triangulator.sample
        if spacing <= 0:
            msg = "spacing must be positive"
            raise ValueError(msg)

        minx, miny, maxx, maxy = poly.bounds
        candidates = self._grid_points_in_bbox(minx, miny, maxx, maxy, spacing)

        mask = np.array([poly.contains(Point(x, y)) for x, y in candidates], dtype=bool)
        points = candidates[mask]

        if len(points) == 0:
            centroid = poly.centroid
            return np.array([[centroid.x, centroid.y]]), []

        if min_edge_distance is not None and min_edge_distance > 0:
            points = self._filter_by_boundary_distance(poly, points, min_edge_distance)
            if len(points) == 0:
                centroid = poly.centroid
                return np.array([[centroid.x, centroid.y]]), []

        adjacency_edges = self._delaunay_edges(points)
        return points, adjacency_edges

    @staticmethod
    def _filter_by_boundary_distance(
        poly: Polygon,
        points: npt.NDArray[np.float64],
        min_edge_distance: float,
    ) -> npt.NDArray[np.float64]:
        """Keep only points at least min_edge_distance from the polygon boundary."""
        valid = []
        for i in range(len(points)):
            pt = Point(points[i, 0], points[i, 1])
            if pt.distance(poly.exterior) >= min_edge_distance:
                valid.append(i)
        if len(valid) == 0:
            center = poly.centroid
            dists = np.sqrt(
                (points[:, 0] - center.x) ** 2
                + (points[:, 1] - center.y) ** 2,
            )
            valid = [int(np.argmin(dists))]
        return points[valid]
