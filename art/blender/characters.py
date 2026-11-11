"""
Slingstorm character and slingshot renderer.

Every Slingling and Grumplet is a small plush creature: a lumpy body under a
real strand coat, glossy embedded eyes, a mouth, and a per-type silhouette
(ears, drill, crown, helmet, horns...). Silhouette matters here because the
characters are only 50-60 design pixels on a phone, so a plain fuzzy ball would
turn into an anonymous dot.

Each action is rendered as a numbered frame sequence that
scripts/export-art.mjs packs into 4-column spritesheets for Phaser.

Usage (headless):
    blender -b --factory-startup --python art/blender/characters.py -- \
        --kind slingling --type pippin --action idle --out art/render

    blender -b ... -- --kind all --type all --action all
    blender -b ... -- --kind slingshot
"""

from __future__ import annotations

import argparse
import math
import os
import random
import sys

import bpy
from mathutils import Vector

# Matches src/game/projectiles.ts and the Grumplet palette in src/phaser/art.ts.
SLINGLINGS = {
    "pippin": ("#ffcb2e", "#ffe98a", "#c98d00"),
    "boomkin": ("#ff6b3d", "#ffb08a", "#b62f10"),
    "triplet": ("#7ee36a", "#c9ffb8", "#2f8a25"),
    "borebit": ("#d9a15a", "#f5d3a3", "#8a5a1c"),
    "zing": ("#ffe94a", "#fff9b0", "#c1a300"),
    "frostpop": ("#8fe6ff", "#dcf9ff", "#2f9dbf"),
    "ricco": ("#ff7bd6", "#ffc6ec", "#b3318c"),
    "wrecker": ("#9aa7bd", "#dbe4f2", "#525f74"),
    "flux": ("#b28dff", "#e0d2ff", "#6a41c9"),
    "nimbus": ("#bdf0e2", "#e8fff8", "#4fa88f"),
}

GRUMPLETS = {
    "0": ("#6fbf63", "#a8e39b", "#3d7a35"),
    "1": ("#b47ad6", "#dcb8f0", "#6d3f8f"),
    "2": ("#e0a24a", "#f6d09b", "#98601d"),
    "3": ("#7a9bd6", "#b6cbee", "#3f5b8f"),
}

ACTIONS = {
    "idle": 8,
    "blink": 4,
    "launch": 6,
    "happy": 6,
    "scared": 4,
}

GRUMPLET_ACTIONS = {"idle": 6, "blink": 4, "panic": 6}

SIZE = 320
# Fine and dense: a plush coat reads as soft at 50px, a thick sparse one reads
# as a cactus.
STRANDS = 7000
EYE_X = 0.33
EYE_Z = 0.12
MOUTH_Z = -0.26

DRILL = {
    "borebit",
}


def srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def rgba(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    parts = [int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*(srgb_to_linear(part) for part in parts), alpha)


def rgb(hex_color: str) -> tuple[float, float, float]:
    value = hex_color.lstrip("#")
    return tuple(srgb_to_linear(int(value[i : i + 2], 16) / 255) for i in (0, 2, 4))  # type: ignore[return-value]


def set_if(target: object, name: str, value: object) -> None:
    if hasattr(target, name):
        try:
            setattr(target, name, value)
        except (TypeError, ValueError):
            pass


def set_input(bsdf: object, name: str, value: object) -> None:
    if hasattr(bsdf, "inputs") and name in bsdf.inputs:
        try:
            bsdf.inputs[name].default_value = value
        except (TypeError, ValueError):
            pass


def choose_engine(scene: bpy.types.Scene) -> None:
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = engine
            return
        except TypeError:
            continue


def reset_scene(size: int) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    choose_engine(scene)
    scene.render.film_transparent = True
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 70
    scene.view_settings.view_transform = "Standard"
    set_if(scene.eevee, "taa_render_samples", 8)
    scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (0.62, 0.66, 0.74, 1.0)
    background.inputs["Strength"].default_value = 0.55


def material(name: str, color: str, roughness: float = 0.6, metallic: float = 0.0, emission: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    set_input(bsdf, "Base Color", rgba(color))
    set_input(bsdf, "Roughness", roughness)
    set_input(bsdf, "Metallic", metallic)
    if emission > 0:
        set_input(bsdf, "Emission Color", rgba(color))
        set_input(bsdf, "Emission Strength", emission)
    return mat


def make_body(scale: tuple[float, float, float] = (1.0, 0.94, 1.02)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=36, radius=1.0)
    body = bpy.context.object
    body.name = "Body"
    bpy.ops.object.shade_smooth()

    tex = bpy.data.textures.new("Lumps", type="CLOUDS")
    tex.noise_scale = 0.6
    displace = body.modifiers.new("Lumps", "DISPLACE")
    displace.texture = tex
    displace.strength = 0.05
    displace.mid_level = 0.5
    displace.texture_coords = "LOCAL"
    body.scale = scale
    return body


def face_clear(direction: Vector) -> bool:
    eyes = [
        Vector((EYE_X, -0.88, EYE_Z)).normalized(),
        Vector((-EYE_X, -0.88, EYE_Z)).normalized(),
    ]
    mouth = Vector((0.0, -0.94, MOUTH_Z)).normalized()
    if any(direction.angle(eye, 0.0) < 0.30 for eye in eyes):
        return False
    if direction.angle(mouth, 0.0) < 0.19:
        return False
    return True


def add_fur(body: bpy.types.Object, palette: tuple[str, str, str], density: int = STRANDS, length_scale: float = 1.0) -> dict:
    base, light, dark = palette
    body.data.materials.append(material("Undercoat", base, 0.72))
    base_rgb, light_rgb, dark_rgb = rgb(base), rgb(light), rgb(dark)

    rng = random.Random(424242)
    golden = math.pi * (3.0 - math.sqrt(5.0))
    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    colours: list[tuple[float, float, float, float]] = []
    weights: list[float] = []
    owners: list[int] = []
    phases: list[tuple[float, float]] = []
    rings = 3
    sides = 4

    for index in range(density):
        z = 1.0 - 2.0 * (index + 0.5) / density
        radius = math.sqrt(max(0.0, 1.0 - z * z))
        theta = golden * index
        direction = Vector((math.cos(theta) * radius, math.sin(theta) * radius, z))
        if not face_clear(direction):
            continue

        length = 0.058 * length_scale * rng.uniform(0.5, 1.4)
        outward = (
            direction + Vector((rng.uniform(-0.18, 0.18), rng.uniform(-0.18, 0.18), rng.uniform(-0.18, 0.18)))
        ).normalized()
        bend = Vector((rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0)))
        bend -= outward * bend.dot(outward)
        if bend.length > 1e-6:
            bend.normalize()

        thick = 0.0092 * rng.uniform(0.7, 1.3)
        helper = Vector((0.0, 0.0, 1.0)) if abs(outward.z) < 0.9 else Vector((1.0, 0.0, 0.0))
        side = outward.cross(helper).normalized()
        up = outward.cross(side).normalized()

        start_index = len(verts)
        strand = len(phases)
        phases.append((rng.uniform(0.0, math.tau), rng.uniform(0.85, 1.2)))
        jitter = rng.uniform(0.84, 1.14)

        for ring in range(rings + 1):
            t = ring / rings
            centre = direction * 0.99 + outward * (length * t) + bend * (length * 1.1 * t * t)
            taper = max(0.0008, thick * (1.0 - t) ** 0.7)
            mix = 0.5 + 0.45 * t
            colour = tuple(
                (dark_rgb[c] * (1.0 - mix) + base_rgb[c] * mix * jitter) * (1.0 - 0.16 * (1.0 - t))
                for c in range(3)
            )
            if t > 0.72:
                colour = tuple(colour[c] * 0.86 + light_rgb[c] * 0.2 for c in range(3))
            for corner in range(sides):
                angle = (corner / sides) * math.tau
                offset = side * math.cos(angle) * taper + up * math.sin(angle) * taper
                point = centre + offset
                verts.append((point.x, point.y, point.z))
                colours.append((colour[0], colour[1], colour[2], 1.0))
                weights.append(t**1.7)
                owners.append(strand)

        for ring in range(rings):
            for corner in range(sides):
                a = start_index + ring * sides + corner
                b = start_index + ring * sides + (corner + 1) % sides
                c = start_index + (ring + 1) * sides + (corner + 1) % sides
                d = start_index + (ring + 1) * sides + corner
                faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new("Coat")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    attribute = mesh.color_attributes.new("furcolor", "FLOAT_COLOR", "POINT")
    for index, colour in enumerate(colours):
        attribute.data[index].color = colour

    coat = bpy.data.objects.new("Coat", mesh)
    bpy.context.collection.objects.link(coat)
    coat.parent = body
    bpy.ops.object.select_all(action="DESELECT")
    coat.select_set(True)
    bpy.context.view_layer.objects.active = coat
    bpy.ops.object.shade_smooth()
    coat.data.materials.append(fur_material())

    flat: list[float] = []
    for x, y, z in verts:
        flat.extend((x, y, z))
    return {"coat": coat, "rest": flat, "weights": weights, "owners": owners, "phases": phases}


def fur_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("Fur")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    set_input(bsdf, "Roughness", 0.62)
    set_if(bsdf, "Specular IOR Level", 0.25)
    set_input(bsdf, "Sheen Weight", 0.4)
    colors = nodes.new("ShaderNodeVertexColor")
    colors.layer_name = "furcolor"
    links.new(colors.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def apply_wind(fur: dict, amount: float, gust: float) -> None:
    """Roots stay pinned, tips stream back along -X, each strand with its own phase."""
    coat = fur["coat"]
    rest = fur["rest"]
    weights = fur["weights"]
    owners = fur["owners"]
    phases = fur["phases"]
    co = list(rest)
    if amount > 0.001:
        for index, weight in enumerate(weights):
            if weight <= 0.0005:
                continue
            phase, speed = phases[owners[index]]
            flutter = 1.0 + 0.3 * math.sin(phase + gust * speed)
            push = weight * amount * flutter
            co[index * 3] -= push * 0.17
            co[index * 3 + 2] += push * 0.03
    coat.data.vertices.foreach_set("co", co)
    coat.data.update()
    bpy.context.view_layer.update()


def add_eyes(roughness: float = 0.16) -> tuple[bpy.types.Object, bpy.types.Object]:
    eyes = []
    for sign, name in ((1, "EyeL"), (-1, "EyeR")):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=36, ring_count=20, radius=1.0, location=(sign * EYE_X, -0.86, EYE_Z)
        )
        eye = bpy.context.object
        eye.name = name
        bpy.ops.object.shade_smooth()
        eye.scale = (0.2, 0.12, 0.215)
        eye.data.materials.append(material(f"{name}Mat", "#241a3a", roughness))

        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=16, ring_count=12, radius=0.052, location=(sign * EYE_X - 0.055, -1.13, EYE_Z + 0.075)
        )
        glint = bpy.context.object
        glint.name = f"{name}Glint"
        bpy.ops.object.shade_smooth()
        glint.scale = (1.0, 0.6, 1.0)
        glint.data.materials.append(material(f"{name}GlintMat", "#ffffff", 0.05, emission=0.5))
        eyes.append(eye)
    return eyes[0], eyes[1]


def add_mouth() -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1.0, location=(0.0, -0.93, MOUTH_Z))
    mouth = bpy.context.object
    mouth.name = "Mouth"
    bpy.ops.object.shade_smooth()
    mouth.scale = (0.075, 0.05, 0.04)
    mouth.data.materials.append(material("MouthMat", "#5b1730", 0.35))
    return mouth


def add_primitive(kind: str, location: tuple[float, float, float], scale: tuple[float, float, float], rotation: tuple[float, float, float], mat: bpy.types.Material, name: str) -> bpy.types.Object:
    if kind == "cone":
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=1.0, depth=2.0, location=location)
    elif kind == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.0, depth=2.0, location=location)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=16, radius=1.0, location=location)
    elif kind == "torus":
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.24, location=location)
    elif kind == "cube":
        bpy.ops.mesh.primitive_cube_add(size=2.0, location=location)
    else:
        raise ValueError(kind)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
    bpy.ops.object.shade_smooth() if kind != "cube" else None
    obj.data.materials.append(mat)
    return obj


def add_accessories(body: bpy.types.Object, kind: str, palette: tuple[str, str, str]) -> list[bpy.types.Object]:
    """A recognisable silhouette per character, so types read at 50px."""
    base, light, dark = palette
    deep = material("AccessoryDeep", dark, 0.55)
    bright = material("AccessoryBright", light, 0.4)
    metal = material("AccessoryMetal", "#c9d3e2", 0.28, metallic=0.85)
    parts: list[bpy.types.Object] = []

    def ear(sign: int, height: float, tilt: float) -> None:
        parts.append(
            add_primitive(
                "cone",
                (sign * 0.4, 0.02, 0.94),
                (0.19, 0.15, height),
                (0.0, -sign * tilt, 0.0),
                deep,
                "Ear",
            )
        )

    if kind == "pippin":
        ear(1, 0.34, 0.5)
        ear(-1, 0.34, 0.5)
    elif kind == "boomkin":
        parts.append(add_primitive("cylinder", (0.0, 0.0, 1.08), (0.05, 0.05, 0.14), (0, 0, 0), deep, "Fuse"))
        parts.append(add_primitive("sphere", (0.0, 0.0, 1.28), (0.11, 0.11, 0.11), (0, 0, 0), material("Spark", "#ffe27a", 0.2, emission=1.6), "Spark"))
        for sign in (1, -1):
            parts.append(
                add_primitive(
                    "cube",
                    (sign * 0.32, -0.93, 0.34),
                    (0.17, 0.03, 0.045),
                    (0, 0, sign * math.radians(24)),
                    deep,
                    "Brow",
                )
            )
    elif kind == "triplet":
        for x, z in ((0.0, 1.04), (-0.3, 0.94), (0.3, 0.94)):
            parts.append(add_primitive("sphere", (x, 0.0, z), (0.17, 0.17, 0.17), (0, 0, 0), bright, "Crest"))
        for sign in (1, -1):
            parts.append(add_primitive("sphere", (sign * 0.62, -0.74, -0.16), (0.09, 0.05, 0.09), (0, 0, 0), material("Freckle", dark, 0.6), "Freckle"))
    elif kind == "borebit":
        parts.append(
            add_primitive(
                "cone",
                (0.0, -1.08, -0.02),
                (0.22, 0.22, 0.3),
                (math.radians(-90), 0, 0),
                metal,
                "Drill",
            )
        )
        parts.append(add_primitive("torus", (0.0, -0.72, -0.02), (0.4, 0.4, 0.4), (math.radians(90), 0, 0), deep, "Brace"))
    elif kind == "zing":
        for sign in (1, -1):
            parts.append(
                add_primitive(
                    "cube",
                    (sign * 0.16, 0.0, 1.1),
                    (0.07, 0.07, 0.24),
                    (sign * math.radians(28), 0, sign * math.radians(18)),
                    bright,
                    "Bolt",
                )
            )
            parts.append(
                add_primitive(
                    "cube",
                    (sign * 0.34, 0.0, 1.3),
                    (0.06, 0.06, 0.2),
                    (-sign * math.radians(32), 0, -sign * math.radians(22)),
                    bright,
                    "Bolt",
                )
            )
    elif kind == "frostpop":
        for x, height in ((0.0, 0.42), (-0.34, 0.28), (0.34, 0.28)):
            parts.append(
                add_primitive("cone", (x, 0.0, 1.0), (0.13, 0.13, height), (0, 0, 0), material("IceCrown", "#dcf9ff", 0.12), "Crown")
            )
        parts.append(add_primitive("torus", (0.0, -0.05, -0.68), (0.58, 0.58, 0.58), (math.radians(90), 0, 0), bright, "FrostRing"))
    elif kind == "ricco":
        for sign in (1, -1):
            parts.append(
                add_primitive(
                    "torus",
                    (sign * 0.72, 0.05, 0.72),
                    (0.26, 0.26, 0.26),
                    (0, math.radians(90), 0),
                    bright,
                    "SpringEar",
                )
            )
    elif kind == "wrecker":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=1.0, location=(0.0, 0.0, 0.62))
        helmet = bpy.context.object
        helmet.name = "Helmet"
        helmet.scale = (1.04, 1.04, 0.72)
        bpy.ops.object.shade_smooth()
        helmet.data.materials.append(metal)
        parts.append(helmet)
        for sign in (1, -1):
            parts.append(add_primitive("sphere", (sign * 0.82, 0.0, 0.56), (0.1, 0.1, 0.1), (0, 0, 0), deep, "Rivet"))
    elif kind == "flux":
        parts.append(add_primitive("cylinder", (0.0, 0.0, 1.12), (0.035, 0.035, 0.2), (0, 0, 0), deep, "Antenna"))
        parts.append(add_primitive("sphere", (0.0, 0.0, 1.34), (0.1, 0.1, 0.1), (0, 0, 0), bright, "AntennaTip"))
        for sign in (1, -1):
            parts.append(
                add_primitive(
                    "torus",
                    (sign * 0.92, 0.0, 0.1),
                    (0.24, 0.24, 0.24),
                    (0, math.radians(90), 0),
                    material("FluxRing", "#e0d2ff", 0.2, emission=0.7),
                    "FluxRing",
                )
            )
    elif kind == "nimbus":
        for x, z, s in ((-0.46, 0.86, 0.24), (0.0, 0.98, 0.3), (0.46, 0.86, 0.24)):
            parts.append(add_primitive("sphere", (x, 0.0, z), (s, s * 0.8, s), (0, 0, 0), bright, "CloudPuff"))
    return parts


def add_grumplet_parts(variant: str, palette: tuple[str, str, str]) -> list[bpy.types.Object]:
    base, light, dark = palette
    deep = material("GrumbleDeep", dark, 0.55)
    bright = material("GrumbleBright", light, 0.35)
    metal = material("GrumbleMetal", "#c9b06a", 0.3, metallic=0.7)
    parts: list[bpy.types.Object] = []

    # Every grumplet is permanently unimpressed.
    for sign in (1, -1):
        parts.append(
            add_primitive(
                "cube",
                (sign * 0.3, -0.92, 0.36),
                (0.19, 0.03, 0.05),
                (0, 0, -sign * math.radians(26)),
                deep,
                "Brow",
            )
        )
    if variant == "0":
        parts.append(add_primitive("cone", (0.0, 0.0, 1.05), (0.16, 0.16, 0.34), (0, 0, 0), metal, "Horn"))
    elif variant == "1":
        parts.append(add_primitive("cone", (0.0, 0.0, 1.12), (0.45, 0.45, 0.5), (0, 0, 0), deep, "Hat"))
        parts.append(add_primitive("torus", (0.0, 0.0, 0.72), (0.44, 0.44, 0.44), (0, 0, 0), bright, "HatBrim"))
    elif variant == "2":
        for sign in (1, -1):
            parts.append(
                add_primitive(
                    "cone",
                    (sign * 0.5, 0.0, 0.96),
                    (0.13, 0.13, 0.3),
                    (0, -sign * math.radians(38), 0),
                    metal,
                    "Horn",
                )
            )
    elif variant == "3":
        for x, height in ((0.0, 0.3), (-0.28, 0.22), (0.28, 0.22)):
            parts.append(add_primitive("cone", (x, 0.0, 1.0), (0.1, 0.1, height), (0, 0, 0), metal, "Crown"))
        for sign in (1, -1):
            parts.append(
                add_primitive(
                    "torus",
                    (sign * 0.33, -0.88, 0.13),
                    (0.14, 0.14, 0.14),
                    (math.radians(80), 0, 0),
                    material("Glasses", "#33304a", 0.25),
                    "Glasses",
                )
            )
    if variant in ("0", "2"):
        parts.append(add_primitive("torus", (0.0, -0.05, -0.6), (0.5, 0.5, 0.5), (math.radians(90), 0, 0), bright, "Belt"))
    return parts


def add_lighting() -> None:
    def area(name: str, location: Vector, energy: float, size: float, colour: tuple[float, float, float]) -> None:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.size = size
        light.data.color = colour
        light.rotation_euler = (Vector((0, 0, 0)) - location).to_track_quat("-Z", "Y").to_euler()

    area("Key", Vector((-2.2, -3.4, 3.2)), 460, 5.0, (1.0, 0.97, 0.92))
    area("Fill", Vector((3.0, -2.0, 0.6)), 180, 6.0, (0.82, 0.9, 1.0))
    area("Rim", Vector((1.2, 3.0, 2.8)), 340, 4.0, (1.0, 0.94, 0.82))


def add_camera(ortho: float = 2.95, height: float = 0.42) -> None:
    bpy.ops.object.camera_add(location=(0.0, -7.2, height), rotation=(math.radians(87.0), 0.0, 0.0))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho
    bpy.context.scene.camera = camera


def build_slingling(kind: str, size: int) -> dict:
    palette = SLINGLINGS[kind]
    reset_scene(size)
    body = make_body()
    fur = add_fur(body, palette)
    eye_l, eye_r = add_eyes()
    mouth = add_mouth()
    parts = add_accessories(body, kind, palette)
    add_lighting()
    add_camera()
    return {
        "body": body,
        "fur": fur,
        "eye_l": eye_l,
        "eye_r": eye_r,
        "mouth": mouth,
        "parts": parts,
        "kind": kind,
    }


def build_grumplet(variant: str, size: int) -> dict:
    palette = GRUMPLETS[variant]
    reset_scene(size)
    body = make_body((1.04, 0.94, 0.96))
    fur = add_fur(body, palette, density=5200, length_scale=0.9)
    eye_l, eye_r = add_eyes(roughness=0.2)
    mouth = add_mouth()
    parts = add_grumplet_parts(variant, palette)
    add_lighting()
    add_camera(3.1, 0.34)
    return {
        "body": body,
        "fur": fur,
        "eye_l": eye_l,
        "eye_r": eye_r,
        "mouth": mouth,
        "parts": parts,
        "kind": "grumplet",
    }


def pose(parts: dict, action: str, frame: int, frames: int) -> None:
    phase = (frame / max(1, frames)) * math.tau
    body = parts["body"]
    eye_l, eye_r = parts["eye_l"], parts["eye_r"]
    mouth = parts["mouth"]

    breathe = math.sin(phase) * 0.018
    body.scale = (1.0 + breathe, 0.94 - breathe * 0.4, 1.02 + breathe)
    body.location = (0.0, 0.0, breathe * 0.05)
    body.rotation_euler = (0.0, 0.0, 0.0)
    mouth.scale = (0.075, 0.05, 0.04)
    mouth.location = (0.0, -0.93, MOUTH_Z)
    eye_scale = [0.2, 0.12, 0.215]
    wind = 0.05
    gust = phase

    if action == "idle":
        body.rotation_euler = (0.0, math.sin(phase) * 0.04, math.sin(phase * 0.5) * 0.03)
        wind = 0.06 + 0.03 * math.sin(phase * 2.0)
    elif action == "blink":
        close = [1.0, 0.35, 0.08, 0.5][min(frame, 3)]
        eye_scale[2] = 0.215 * close
        wind = 0.04
    elif action == "launch":
        if frame <= 1:
            squash = (frame + 1) / 2.0
            body.scale = (1.0 + 0.16 * squash, 0.94 + 0.1 * squash, 1.02 - 0.22 * squash)
            body.location = (0.0, 0.0, -0.08 * squash)
        elif frame <= 3:
            stretch = (frame - 1) / 2.0
            body.scale = (1.0 - 0.08 * stretch, 0.94 - 0.05 * stretch, 1.02 + 0.2 * stretch)
            body.location = (0.0, 0.0, 0.09 * stretch)
            body.rotation_euler = (math.radians(-10) * stretch, 0, 0)
        else:
            settle = 1.0 - (frame - 3) / max(1.0, frames - 3)
            body.scale = (1.0 - 0.02 * settle, 0.94, 1.02 + 0.05 * settle)
        eye_scale = [0.235, 0.12, 0.26]
        mouth.scale = (0.085, 0.05, 0.075)
        wind = 0.3 + 0.12 * math.sin(phase * 2.0)
        gust = phase * 2.6
    elif action == "happy":
        beat = abs(math.sin(phase))
        body.location = (0.0, 0.0, beat * 0.08)
        body.scale = (1.0 + 0.04 * math.sin(phase * 2), 0.94, 1.02 + 0.06 * math.sin(phase * 2))
        body.rotation_euler = (0.0, math.sin(phase * 2) * math.radians(6), math.sin(phase) * math.radians(8))
        eye_scale = [0.215, 0.12, 0.1]
        mouth.scale = (0.11, 0.05, 0.085)
        wind = 0.18 + 0.14 * math.sin(phase * 2.4)
        gust = phase * 2.2
    elif action == "scared":
        shake = math.sin(phase * 6) * 0.02
        body.location = (shake, 0.0, 0.02)
        body.scale = (0.96, 0.94, 1.08)
        body.rotation_euler = (0.0, math.sin(phase * 5) * math.radians(4), 0.0)
        eye_scale = [0.25, 0.12, 0.28]
        mouth.scale = (0.06, 0.05, 0.09)
        wind = 0.22
        gust = phase * 3.0
    elif action == "panic":
        shake = math.sin(phase * 7) * 0.03
        body.location = (shake, 0.0, 0.0)
        body.scale = (1.02 + 0.03 * math.sin(phase * 3), 0.94, 0.94 + 0.05 * math.sin(phase * 3))
        body.rotation_euler = (0.0, math.sin(phase * 4) * math.radians(7), 0.0)
        eye_scale = [0.26, 0.12, 0.3]
        mouth.scale = (0.08, 0.05, 0.11)
        mouth.location = (0.0, -0.93, MOUTH_Z - 0.03)
        wind = 0.24
        gust = phase * 3.2

    for eye in (eye_l, eye_r):
        eye.scale = (eye_scale[0], eye_scale[1], eye_scale[2])

    apply_wind(parts["fur"], wind, gust)


def render_action(parts: dict, out_dir: str, name: str, action: str, frames: int) -> None:
    target = os.path.join(out_dir, name, action)
    os.makedirs(target, exist_ok=True)
    scene = bpy.context.scene
    for frame in range(frames):
        pose(parts, action, frame, frames)
        scene.frame_set(frame + 1)
        scene.render.filepath = os.path.join(target, f"{action}_{frame:02d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[slingstorm] {name}/{action} {frame + 1}/{frames}", flush=True)


def build_slingshot(size: int) -> None:
    reset_scene(size)
    wood = material("Wood", "#9a5c2e", 0.62)
    wood_light = material("WoodLight", "#c98a4e", 0.55)
    leather = material("Leather", "#6b3f2a", 0.72)
    metal = material("Band", "#d9d2c4", 0.4)
    pieces: list[bpy.types.Object] = []

    pieces.append(add_primitive("cylinder", (0.0, 0.0, -0.5), (0.16, 0.16, 0.78), (0, 0, 0), wood, "Handle"))
    for sign in (1, -1):
        pieces.append(
            add_primitive(
                "cylinder",
                (sign * 0.27, 0.0, 0.34),
                (0.13, 0.13, 0.72),
                (0, -sign * math.radians(22), 0),
                wood,
                "Arm",
            )
        )
        pieces.append(
            add_primitive(
                "torus",
                (sign * 0.47, 0.0, 0.73),
                (0.1, 0.1, 0.1),
                (math.radians(90), 0, 0),
                metal,
                "Wrap",
            )
        )
    pieces.append(add_primitive("sphere", (0.0, -0.03, 0.02), (0.23, 0.15, 0.26), (0, 0, 0), leather, "Grip"))
    pieces.append(add_primitive("torus", (0.0, 0.0, 0.0), (0.17, 0.17, 0.17), (math.radians(90), 0, 0), wood_light, "Ring"))

    add_lighting()
    bpy.ops.object.camera_add(location=(0.0, -6.0, 0.35), rotation=(math.radians(88.0), 0.0, 0.0))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.5
    bpy.context.scene.camera = camera

    out_dir = os.path.join("art", "render", "slingshot")
    os.makedirs(out_dir, exist_ok=True)
    bpy.context.scene.render.filepath = os.path.join(out_dir, "slingshot.png")
    bpy.ops.render.render(write_still=True)
    print("[slingstorm] slingshot rendered", flush=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", default="slingling", help="slingling, grumplet, slingshot or all")
    parser.add_argument("--type", default="pippin", help="a type, 'all' or a comma separated list")
    parser.add_argument("--action", default="idle", help="an action, 'all' or a comma separated list")
    parser.add_argument("--size", type=int, default=SIZE)
    parser.add_argument("--out", default="art/render")
    args = parser.parse_args(argv)

    kinds = ["slingling", "grumplet", "slingshot"] if args.kind == "all" else [args.kind]
    if "slingshot" in kinds:
        build_slingshot(512)
    if "slingling" in kinds:
        types = list(SLINGLINGS) if args.type == "all" else [name.strip() for name in args.type.split(",") if name.strip()]
        actions = list(ACTIONS) if args.action == "all" else [name.strip() for name in args.action.split(",") if name.strip()]
        for kind in types:
            parts = build_slingling(kind, args.size)
            for action in actions:
                render_action(parts, args.out, kind, action, ACTIONS[action])
    if "grumplet" in kinds:
        types = list(GRUMPLETS) if args.type == "all" else [name.strip() for name in args.type.split(",") if name.strip()]
        actions = list(GRUMPLET_ACTIONS) if args.action == "all" else [name.strip() for name in args.action.split(",") if name.strip()]
        for variant in types:
            parts = build_grumplet(variant, args.size)
            for action in actions:
                render_action(parts, os.path.join(args.out, "grumplet"), variant, action, GRUMPLET_ACTIONS[action])


if __name__ == "__main__":
    main()
