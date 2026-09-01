/**
 * The hero: the facility twin, rendered from the twin's own captured geometry.
 *
 * Every number this draws came out of `/api/twin` on a real three-camera
 * `vantage facility` run — the floor plan and its sectors, three camera mounts
 * with their real yaw, pitch, field of view and range, eleven anonymous entities
 * at their real positions, and the trail each of them left. Nothing is invented,
 * and there is no fallback that draws a populated building when the twin is
 * empty; the console removed exactly that fallback for exactly this reason.
 *
 * **Why this is the hero rather than footage.** The twin has never held an image.
 * It holds a floor plan and anonymous positions, which is what the whole project
 * argues a video system should reduce to. Showing a person's face to sell a
 * system that deliberately never learns faces would be the single most dishonest
 * thing this page could do; showing the dot that person becomes is the argument
 * itself.
 *
 * Budgets, because they are the reason for several odd choices below:
 * draw calls stay under 100 (measured through `renderer.info`, exposed via
 * `onStats`), the entities and trails are instanced or merged rather than one
 * mesh each, and nothing is added to the scene after the first frame.
 */

import * as THREE from 'three';

export interface TwinCamera {
  camera_id: string;
  name: string;
  position: [number, number, number];
  yaw_deg: number;
  pitch_deg: number;
  fov_deg: number;
  range_m: number;
  color?: string;
}

export interface TwinEntity {
  entity_id: string;
  label: string;
  position: [number, number, number];
  camera_id?: string;
  motion?: string | null;
  speed?: number | null;
}

export interface TwinRoom {
  id: string;
  name: string;
  bounds: [number, number, number, number];
  floor_color?: string;
  wall_color?: string;
}

export interface TwinPayload {
  available: boolean;
  facility: {
    width_m: number;
    depth_m: number;
    height_m: number;
    rooms: TwinRoom[];
    walls: number[][];
  } | null;
  cameras: TwinCamera[];
  entities: TwinEntity[];
  trails: Record<string, [number, number, number][]>;
}

export interface HeroStats {
  calls: number;
  triangles: number;
  entities: number;
  cameras: number;
}

const COLOR = {
  background: 0x14110d,
  grid: 0x4a3d30,
  floor: 0x2b2620,
  wall: 0x5c4a38,
  camera: 0xb08d57,
  frustum: 0xc9a96e,
  entity: 0xc4b898,
  person: 0xb33a2e,
  trail: 0xb08d57,
};

export interface HeroHandle {
  /** 0 at the top of the page, 1 when the hero has been scrolled past. */
  setProgress(value: number): void;
  dispose(): void;
}

const diagonalOf = (facility: { width_m: number; depth_m: number }): number =>
  Math.hypot(facility.width_m, facility.depth_m);

export function mountTwin(
  canvas: HTMLCanvasElement,
  twin: TwinPayload,
  options: { reducedMotion: boolean; onStats?: (stats: HeroStats) => void },
): HeroHandle | null {
  const facility = twin.facility;
  if (!twin.available || !facility) return null;

  const parent = canvas.parentElement;
  const width = parent?.clientWidth || 1200;
  const height = parent?.clientHeight || 700;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  // Capped at 2. A 3x device pixel ratio quadruples the fragment cost for a
  // difference nobody sees, and it is the usual reason a hero runs at 40fps on
  // a phone.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOR.background);
  // Depth as haze rather than as perspective alone: the far wall of a 40-metre
  // room should recede.
  scene.fog = new THREE.Fog(COLOR.background, diagonalOf(facility) * 0.9, diagonalOf(facility) * 2.6);

  const centre = new THREE.Vector3(facility.width_m / 2, 0, facility.depth_m / 2);
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 200);

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(value: T): T => {
    disposables.push(value);
    return value;
  };

  // ── the floor and its sectors ─────────────────────────────────────────────
  const floorGeometry = track(new THREE.PlaneGeometry(facility.width_m, facility.depth_m));
  const floor = new THREE.Mesh(
    floorGeometry,
    track(new THREE.MeshStandardMaterial({ color: COLOR.floor, roughness: 0.95, metalness: 0 })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centre.x, -0.02, centre.z);
  scene.add(floor);

  const grid = new THREE.GridHelper(
    Math.max(facility.width_m, facility.depth_m),
    Math.round(Math.max(facility.width_m, facility.depth_m)),
    COLOR.grid,
    COLOR.grid,
  );
  grid.position.set(centre.x, 0, centre.z);
  (grid.material as THREE.Material).opacity = 0.7;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);
  disposables.push(grid.geometry, grid.material as THREE.Material);

  // One line segment set for every sector outline, merged into a single draw.
  const sectorPoints: number[] = [];
  for (const room of facility.rooms) {
    const [x1, z1, x2, z2] = room.bounds;
    const corners: [number, number][] = [
      [x1, z1],
      [x2, z1],
      [x2, z2],
      [x1, z2],
    ];
    for (let i = 0; i < corners.length; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      sectorPoints.push(a[0], 0.01, a[1], b[0], 0.01, b[1]);
    }
  }
  const sectorGeometry = track(new THREE.BufferGeometry());
  sectorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sectorPoints, 3));
  scene.add(
    new THREE.LineSegments(
      sectorGeometry,
      track(new THREE.LineBasicMaterial({ color: COLOR.wall, transparent: true, opacity: 0.9 })),
    ),
  );

  // ── the outer walls ───────────────────────────────────────────────────────
  const wallPoints: number[] = [];
  for (const wall of facility.walls) {
    const [x1, z1, x2, z2, wallHeight] = wall;
    const h = wallHeight ?? facility.height_m;
    wallPoints.push(x1, 0, z1, x2, 0, z2);
    wallPoints.push(x1, 0, z1, x1, h, z1);
    wallPoints.push(x1, h, z1, x2, h, z2);
  }
  const wallGeometry = track(new THREE.BufferGeometry());
  wallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wallPoints, 3));
  scene.add(
    new THREE.LineSegments(
      wallGeometry,
      track(new THREE.LineBasicMaterial({ color: COLOR.wall, transparent: true, opacity: 0.75 })),
    ),
  );

  // ── the cameras, and what each of them can actually see ───────────────────
  //
  // A cone whose apex is at the mount, aimed along the mount's real yaw and
  // pitch, with the real half-angle and the real range. `lookAt` points a mesh's
  // +Z at its target while cameras and lights face -Z, which is why the cone is
  // rotated onto its own axis first; getting this wrong aims every frustum
  // backwards into the sky, and it looks plausible enough to ship.
  const cameraMountGeometry = track(new THREE.SphereGeometry(0.28, 12, 10));
  const cameraMountMaterial = track(new THREE.MeshBasicMaterial({ color: COLOR.camera }));
  const frustumMaterial = track(
    new THREE.MeshBasicMaterial({
      color: COLOR.frustum,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  for (const cam of twin.cameras) {
    const [x, y, z] = cam.position;
    const mount = new THREE.Mesh(cameraMountGeometry, cameraMountMaterial);
    mount.position.set(x, y, z);
    scene.add(mount);

    const range = Math.max(cam.range_m, 1);
    const halfAngle = THREE.MathUtils.degToRad(cam.fov_deg) / 2;
    const radius = Math.tan(halfAngle) * range;
    const cone = track(new THREE.ConeGeometry(radius, range, 20, 1, true));
    // The cone is built around +Y with its apex up; move the apex to the origin
    // and lay it along +Z so `lookAt` aims it correctly.
    cone.translate(0, -range / 2, 0);
    cone.rotateX(Math.PI / 2);

    const frustum = new THREE.Mesh(cone, frustumMaterial);
    frustum.position.set(x, y, z);

    const yaw = THREE.MathUtils.degToRad(cam.yaw_deg);
    const pitch = THREE.MathUtils.degToRad(cam.pitch_deg);
    frustum.lookAt(
      x + Math.sin(yaw) * Math.cos(pitch) * range,
      y + Math.sin(pitch) * range,
      z + Math.cos(yaw) * Math.cos(pitch) * range,
    );
    scene.add(frustum);
  }

  // ── the entities, instanced ───────────────────────────────────────────────
  //
  // Two instanced meshes rather than one with per-instance colours. `setColorAt`
  // multiplies the *diffuse* term only, so any emissive bright enough to make
  // these read in a dim room is a constant white added on top of every instance,
  // and the one distinction the shot is drawing - three people among eight cars,
  // bicycles and a truck - washes out into a uniform grey. Two materials cost one
  // extra draw call and are exactly right.
  //
  // The distinction is the label the detector gave, never an identity. Vantage
  // knows that `global_person_11` is a person; it has no idea and no means of
  // knowing who.
  const entities = twin.entities;
  const bodyGeometry = track(new THREE.CapsuleGeometry(0.24, 1.25, 4, 10));

  const group = (label: (entity: TwinEntity) => boolean, color: number, emissive: number) => {
    const members = entities.filter(label);
    if (members.length === 0) return null;
    const material = track(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.05,
        emissive: new THREE.Color(emissive),
        emissiveIntensity: 0.5,
      }),
    );
    const mesh = new THREE.InstancedMesh(bodyGeometry, material, members.length);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const matrix = new THREE.Matrix4();
    members.forEach((entity, index) => {
      const [x, , z] = entity.position;
      matrix.makeTranslation(x, 0.86, z);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  };

  const people = group((entity) => entity.label === 'person', COLOR.person, 0x8a2b21);
  const others = group((entity) => entity.label !== 'person', COLOR.entity, 0x6b5545);

  // ── the trails, merged into one draw ──────────────────────────────────────
  const trailPoints: number[] = [];
  for (const points of Object.values(twin.trails)) {
    for (let i = 1; i < points.length; i += 1) {
      const [ax, , az] = points[i - 1];
      const [bx, , bz] = points[i];
      trailPoints.push(ax, 0.06, az, bx, 0.06, bz);
    }
  }
  if (trailPoints.length > 0) {
    const trailGeometry = track(new THREE.BufferGeometry());
    trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPoints, 3));
    scene.add(
      new THREE.LineSegments(
        trailGeometry,
        track(new THREE.LineBasicMaterial({ color: COLOR.trail, transparent: true, opacity: 0.9 })),
      ),
    );
  }

  // ── light ─────────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xe8e2d4, 0.55));
  const key = new THREE.DirectionalLight(0xffe9c4, 1.05);
  key.position.set(centre.x - facility.width_m, facility.depth_m * 1.4, centre.z - facility.depth_m);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb33a2e, 0.25);
  fill.position.set(centre.x + facility.width_m, facility.height_m * 2, centre.z + facility.depth_m);
  scene.add(fill);

  // ── the camera move ───────────────────────────────────────────────────────
  //
  // Scroll drives an orbit from a low, near, oblique view - where the room reads
  // as a place - to a high plan view, where it reads as data. That is the beat's
  // whole claim in one movement, and it is why the hero is worth WebGL at all.
  //
  // Under reduced motion the ambient drift is not slowed, it is absent: the
  // camera sits at the opening vantage point and moves only when the reader
  // scrolls, which is a movement they asked for.
  let progress = 0;
  let disposed = false;
  const clock = new THREE.Clock();

  // The opening radius is derived from the facility rather than chosen, so a
  // twin of a different size frames itself. Half the diagonal is the radius that
  // just contains the floor; 1.55x that leaves the room sitting inside the frame
  // with air around it rather than pressed against the edges. The first version
  // used a fixed 26m, which on this 40x24 model put the camera inside the
  // building with two entities looming in the foreground like furniture.
  const diagonal = Math.hypot(facility.width_m, facility.depth_m);
  const near = diagonal * 1.18;
  const far = diagonal * 1.3;

  const place = () => {
    const eased = progress * progress * (3 - 2 * progress);
    const radius = THREE.MathUtils.lerp(near, far, eased);
    const elevation = THREE.MathUtils.lerp(diagonal * 0.22, diagonal * 1.1, eased);
    const drift = options.reducedMotion ? 0 : Math.sin(clock.getElapsedTime() * 0.06) * 0.1;
    const angle = -0.7 + eased * 0.5 + drift;

    camera.position.set(
      centre.x + Math.sin(angle) * radius,
      elevation,
      centre.z + Math.cos(angle) * radius,
    );
    camera.lookAt(centre.x, THREE.MathUtils.lerp(2.2, 0, eased), centre.z);
  };
  place();

  let frame = 0;
  let visible = true;
  const render = () => {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (!visible) return;
    place();
    renderer.render(scene, camera);
    options.onStats?.({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      entities: entities.length,
      cameras: twin.cameras.length,
    });
  };
  frame = requestAnimationFrame(render);

  // Nothing renders while the hero is not on screen. A hidden tab is the obvious
  // case; the one that actually matters is a reader four beats down the page,
  // where a full-viewport WebGL scene would otherwise keep a laptop fan running
  // through the whole of the rest of the argument.
  const onVisibility = () => {
    visible = !document.hidden && onScreen;
  };
  let onScreen = true;
  document.addEventListener('visibilitychange', onVisibility);

  const intersection =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          (entries) => {
            onScreen = entries.some((entry) => entry.isIntersecting);
            onVisibility();
          },
          { threshold: 0 },
        );
  if (intersection && parent) intersection.observe(parent);

  const onResize = () => {
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', onResize);

  return {
    setProgress(value: number) {
      progress = Math.min(Math.max(value, 0), 1);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      intersection?.disconnect();
      people?.dispose();
      others?.dispose();
      for (const item of disposables) item.dispose();
      renderer.dispose();
    },
  };
}
