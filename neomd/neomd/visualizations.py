"""
This part of the module wraps up any visualizations avaliable in an easy to use format.
"""

from ovito.io.ase import ase_to_ovito
from ovito.pipeline import Pipeline, StaticSource
from ovito.vis import TachyonRenderer, Viewport


def default(*_):
    """
    Default modifier for pipelines, does nothing.
    """
    pass


def build_pipeline(ase_atoms, pipeline_modifier=default, data={}):
    ovito_atoms = ase_to_ovito(ase_atoms)

    ovito_atoms.cell.vis.enabled = False
    pipeline = Pipeline(source=StaticSource(data=ovito_atoms))

    pipeline_modifier(pipeline, data)

    return pipeline


# TODO: add viewport modifier
def render_ASE(
    ase_atoms,
    output_path=None,
    image_width=800,
    image_height=800,
    pipeline_modifier=default,
    crop=True,
):
    """
    Writes an atoms object to a png file.

    :param ase_atoms: - ASE Atoms object to render
    :param output_path: If provided, Ovito will write an image to this location
    :param image_width: Width of image
    :param image_height: Height of the image
    :param pipeline_modifier: Function that modifies pipeline

    :returns: QImage of the rendered picture.
    """
    # wrap positions
    pipeline = build_pipeline(ase_atoms, pipeline_modifier)
    pipeline.compute()
    pipeline.add_to_scene()

    vp = Viewport(type=Viewport.Type.Perspective, camera_dir=(2, 1, -1))
    vp.zoom_all(size=(image_width, image_height))

    img = None
    if output_path is None:
        img = vp.render_image(
            size=(image_width, image_height),
            renderer=TachyonRenderer(shadows=False),
            crop=crop,
        )
    else:
        img = vp.render_image(
            crop=crop,
            size=(image_width, image_height),
            filename=output_path,
            renderer=TachyonRenderer(shadows=False),
        )

    pipeline.remove_from_scene()
    return img
