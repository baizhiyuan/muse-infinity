const TAU = Math.PI * 2;

const fract = value => value - Math.floor(value);
const random = (index, salt = 0) => fract(Math.sin(index * 91.733 + salt * 37.719) * 43758.5453);

function point(points, x, y, z, family = "stone", size = 1, seed = points.length) {
  points.push({ x, y, z, family, size, seed: random(seed, 8) * TAU });
}

function line(points, a, b, count, family = "stone", size = 1, salt = 0) {
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const scatter = (random(i + salt, 2) - .5) * .035;
    point(points,
      a[0] + (b[0] - a[0]) * t + scatter,
      a[1] + (b[1] - a[1]) * t + scatter,
      a[2] + (b[2] - a[2]) * t + scatter,
      family, size, i + salt);
  }
}

function plane(points, origin, u, v, columns, rows, family = "stone", mask = () => true, salt = 0) {
  for (let iy = 0; iy < rows; iy += 1) {
    for (let ix = 0; ix < columns; ix += 1) {
      const nx = columns === 1 ? 0 : ix / (columns - 1);
      const ny = rows === 1 ? 0 : iy / (rows - 1);
      if (!mask(nx, ny)) continue;
      const index = iy * columns + ix + salt;
      const jitter = (random(index, 4) - .5) * .055;
      point(points,
        origin[0] + u[0] * nx + v[0] * ny + jitter,
        origin[1] + u[1] * nx + v[1] * ny + jitter,
        origin[2] + u[2] * nx + v[2] * ny + jitter,
        family, .75 + random(index, 5) * .7, index);
    }
  }
}

function column(points, x, z, height, salt) {
  for (let ring = 0; ring < 13; ring += 1) {
    const y = -2.35 + (height * ring) / 12;
    const radius = ring < 2 || ring > 10 ? .24 : .15;
    for (let i = 0; i < 15; i += 1) {
      const angle = (i / 15) * TAU;
      point(points, x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius, "ivory", 1.05, salt + ring * 15 + i);
    }
  }
  line(points, [x - .36, -2.35, z], [x + .36, -2.35, z], 18, "gold", 1.1, salt + 300);
  line(points, [x - .34, -2.35 + height, z], [x + .34, -2.35 + height, z], 18, "gold", 1.1, salt + 350);
}

function arch(points, cx, baseY, z, radius, height, family, salt) {
  line(points, [cx - radius, baseY, z], [cx - radius, baseY + height, z], 42, family, 1.15, salt);
  line(points, [cx + radius, baseY, z], [cx + radius, baseY + height, z], 42, family, 1.15, salt + 50);
  for (let layer = 0; layer < 4; layer += 1) {
    const r = radius + layer * .085;
    for (let i = 0; i < 72; i += 1) {
      const angle = Math.PI + (i / 71) * Math.PI;
      point(points, cx + Math.cos(angle) * r, baseY + height + Math.sin(angle) * r, z + (random(i + salt, 3) - .5) * .07, family, 1.15, salt + layer * 100 + i);
    }
  }
}

function branch(points, x, y, z, direction, salt) {
  const endpoints = [];
  for (let i = 0; i < 7; i += 1) {
    const bend = (random(i + salt, 2) - .5) * 1.1;
    const end = [x + direction * (1.8 + i * .34), y + .4 + i * .52 + bend, z + (random(i + salt, 3) - .5) * 2.4];
    endpoints.push(end);
    line(points, [x, y + i * .12, z], end, 18, "garden", .85, salt + i * 30);
    for (let leaf = 0; leaf < 18; leaf += 1) {
      const angle = random(leaf + salt + i, 5) * TAU;
      const radius = .08 + random(leaf + salt + i, 6) * .7;
      point(points, end[0] + Math.cos(angle) * radius, end[1] + Math.sin(angle) * radius * .55, end[2] + (random(leaf + salt, 7) - .5) * .8, "garden", .7 + random(leaf + salt, 8), salt + i * 50 + leaf);
    }
  }
  return endpoints;
}

export function createMemoryWorld() {
  const points = [];

  // A floor made from broken perspective traces, not a solid grid.
  for (let z = 3; z <= 25; z += .72) {
    line(points, [-8.4, -2.5, z], [8.4, -2.5, z], 34, z % 2 < 1 ? "mist" : "stone", .65, Math.round(z * 70));
  }
  for (let x = -8; x <= 8; x += 1.15) {
    line(points, [x, -2.5, 3], [x, -2.5, 25], 40, "mist", .58, Math.round((x + 9) * 90));
  }

  // The impossible manor: a facade, central arch and fractured roof.
  plane(points, [-5.4, -2.35, 15.5], [10.8, 0, 0], [0, 5.7, 0], 62, 31, "stone", (x, y) => {
    const px = x * 10.8 - 5.4;
    const py = y * 5.7 - 2.35;
    const centralDoor = Math.abs(px) < 1.35 && py < 1.45;
    const window = (Math.abs(px - 3.35) < .72 || Math.abs(px + 3.35) < .72) && py > -.4 && py < 1.5;
    return !centralDoor && !window && random(Math.round((x + y) * 1000), 9) > .2;
  }, 900);
  arch(points, 0, -2.35, 15.32, 1.35, 1.25, "gold", 1500);
  arch(points, -3.35, -.42, 15.3, .7, .7, "cyan", 1800);
  arch(points, 3.35, -.42, 15.3, .7, .7, "cyan", 2050);
  line(points, [-6.05, 3.3, 15.5], [0, 5.25, 15.5], 105, "ivory", 1.15, 2200);
  line(points, [0, 5.25, 15.5], [6.05, 3.3, 15.5], 105, "ivory", 1.15, 2400);
  line(points, [-6.05, 3.3, 15.5], [6.05, 3.3, 15.5], 125, "gold", .9, 2600);
  line(points, [-5.8, -2.35, 15.4], [-5.8, 3.3, 15.4], 70, "ivory", 1, 2800);
  line(points, [5.8, -2.35, 15.4], [5.8, 3.3, 15.4], 70, "ivory", 1, 2900);

  // Colonnades pull the facade toward the camera and create true depth.
  for (let z = 5.8, i = 0; z < 14.8; z += 2.1, i += 1) {
    column(points, -4.65, z, 4.2, 3100 + i * 500);
    column(points, 4.65, z, 4.2, 5600 + i * 500);
    line(points, [-4.65, 1.85, z], [-4.65, 1.85, z + 1.9], 35, "stone", .8, 8000 + i * 60);
    line(points, [4.65, 1.85, z], [4.65, 1.85, z + 1.9], 35, "stone", .8, 8300 + i * 60);
  }

  // Foreground vegetation frames the architecture and exaggerates parallax.
  branch(points, -6.7, -2.2, 4.2, 1, 9100);
  branch(points, 6.8, -2.25, 4.7, -1, 10100);
  branch(points, -7.5, -2.3, 9.5, 1, 11100);
  branch(points, 7.7, -2.3, 10.5, -1, 12100);

  // Sparse airborne matter fills the void without turning it into a star field.
  for (let i = 0; i < 980; i += 1) {
    point(points,
      (random(i, 10) - .5) * 19,
      -2 + random(i, 11) * 8,
      2 + random(i, 12) * 26,
      random(i, 13) > .76 ? "cyan" : "dust",
      .35 + random(i, 14) * .85,
      13000 + i);
  }
  return points;
}

export const memoryPalette = {
  stone: [138, 128, 118],
  ivory: [226, 216, 196],
  gold: [203, 161, 102],
  cyan: [78, 145, 146],
  garden: [54, 105, 90],
  mist: [88, 107, 111],
  dust: [151, 140, 127]
};
