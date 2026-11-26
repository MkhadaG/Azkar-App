//! Prayer icons for the native taskbar indicator.
//!
//! Each icon is made of simple signed-distance shapes (circles, capsules,
//! stars). Every pixel is anti-aliased from its distance to each shape and
//! filled with a vertical gradient, so the icons stay sharp at any DPI.
//! Pixels are premultiplied ARGB, the layout expected by
//! UpdateLayeredWindow with AC_SRC_ALPHA.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PrayerIcon {
    Fajr,
    Sunrise,
    Dhuhr,
    Asr,
    Maghrib,
    Isha,
}

impl PrayerIcon {
    pub fn from_key(key: &str) -> Option<Self> {
        match key.to_ascii_lowercase().as_str() {
            "fajr" => Some(Self::Fajr),
            "sunrise" => Some(Self::Sunrise),
            "dhuhr" => Some(Self::Dhuhr),
            "asr" => Some(Self::Asr),
            "maghrib" => Some(Self::Maghrib),
            "isha" => Some(Self::Isha),
            _ => None,
        }
    }
}

type Point = (f32, f32);
type Rgb = [f32; 3];

// Gradient colours run from the top of the icon to the bottom.
const MOON_TOP: Rgb = [246.0, 247.0, 250.0];
const MOON_BOTTOM: Rgb = [150.0, 156.0, 166.0];
const NIGHT_MOON_TOP: Rgb = [214.0, 222.0, 238.0];
const NIGHT_MOON_BOTTOM: Rgb = [112.0, 124.0, 150.0];
const SUN_TOP: Rgb = [255.0, 226.0, 90.0];
const SUN_BOTTOM: Rgb = [255.0, 146.0, 20.0];
const DEEP_SUN_TOP: Rgb = [255.0, 196.0, 70.0];
const DEEP_SUN_BOTTOM: Rgb = [240.0, 110.0, 18.0];
const SUNSET_TOP: Rgb = [255.0, 160.0, 60.0];
const SUNSET_BOTTOM: Rgb = [228.0, 72.0, 44.0];
const HORIZON: Rgb = [176.0, 182.0, 192.0];
const STAR: Rgb = [255.0, 255.0, 255.0];

#[derive(Clone, Copy)]
struct Layer {
    /// Signed distance in pixels from the shape edge. Negative inside the shape.
    distance: f32,
    top: Rgb,
    bottom: Rgb,
}

const MAX_LAYERS: usize = 12;

#[derive(Clone, Copy)]
struct Layers {
    items: [Layer; MAX_LAYERS],
    len: usize,
}

impl Layers {
    fn new() -> Self {
        let empty = Layer { distance: f32::MAX, top: [0.0; 3], bottom: [0.0; 3] };
        Self { items: [empty; MAX_LAYERS], len: 0 }
    }

    fn push(&mut self, distance: f32, top: Rgb, bottom: Rgb) {
        if self.len < MAX_LAYERS {
            self.items[self.len] = Layer { distance, top, bottom };
            self.len += 1;
        }
    }
}

fn circle(p: Point, centre: Point, radius: f32) -> f32 {
    ((p.0 - centre.0).powi(2) + (p.1 - centre.1).powi(2)).sqrt() - radius
}

/// Distance to a line segment with round ends, `thickness` wide.
fn capsule(p: Point, a: Point, b: Point, thickness: f32) -> f32 {
    let (ax, ay) = (p.0 - a.0, p.1 - a.1);
    let (bx, by) = (b.0 - a.0, b.1 - a.1);
    let t = ((ax * bx + ay * by) / (bx * bx + by * by)).clamp(0.0, 1.0);
    let (dx, dy) = (ax - bx * t, ay - by * t);
    (dx * dx + dy * dy).sqrt() - thickness / 2.0
}

/// Four-pointed sparkle centred on `centre`, `radius` from centre to tip.
fn sparkle(p: Point, centre: Point, radius: f32) -> f32 {
    let dx = (p.0 - centre.0).abs();
    let dy = (p.1 - centre.1).abs();
    (dx + dy - radius) * std::f32::consts::FRAC_1_SQRT_2
}

/// A sun-style disk with straight rays. `angles` are in degrees, 0 pointing right.
fn push_sun(
    layers: &mut Layers,
    p: Point,
    s: f32,
    centre: Point,
    disk_radius: f32,
    angles: &[f32],
    ray_inner: f32,
    ray_outer: f32,
    top: Rgb,
    bottom: Rgb,
) {
    layers.push(circle(p, centre, disk_radius * s), top, bottom);
    for angle in angles {
        let radians = angle.to_radians();
        let (dx, dy) = (radians.cos(), radians.sin());
        let a = (centre.0 + dx * ray_inner * s, centre.1 + dy * ray_inner * s);
        let b = (centre.0 + dx * ray_outer * s, centre.1 + dy * ray_outer * s);
        layers.push(capsule(p, a, b, 0.075 * s), top, bottom);
    }
}

/// A half sun sitting on a horizon line, with a horizon bar under it.
fn push_setting_sun(
    layers: &mut Layers,
    p: Point,
    s: f32,
    horizon_y: f32,
    top: Rgb,
    bottom: Rgb,
) {
    let disk = circle(p, (0.5 * s, horizon_y * s), 0.27 * s);
    // Keep only the part above the horizon.
    layers.push(disk.max(p.1 - horizon_y * s), top, bottom);
    layers.push(
        capsule(p, (0.12 * s, (horizon_y + 0.12) * s), (0.88 * s, (horizon_y + 0.12) * s), 0.08 * s),
        HORIZON,
        HORIZON,
    );
}

fn layers_for(icon: PrayerIcon, s: f32, p: Point) -> Layers {
    let mut layers = Layers::new();
    match icon {
        PrayerIcon::Fajr => {
            // Crescent moon with a soft grey gradient.
            let outer = circle(p, (0.52 * s, 0.5 * s), 0.36 * s);
            let inner = circle(p, (0.66 * s, 0.36 * s), 0.31 * s);
            layers.push(outer.max(-inner), MOON_TOP, MOON_BOTTOM);
        }
        PrayerIcon::Isha => {
            // Night crescent with a cooler gradient and a small star.
            let outer = circle(p, (0.52 * s, 0.5 * s), 0.36 * s);
            let inner = circle(p, (0.66 * s, 0.36 * s), 0.31 * s);
            layers.push(outer.max(-inner), NIGHT_MOON_TOP, NIGHT_MOON_BOTTOM);
            layers.push(sparkle(p, (0.82 * s, 0.22 * s), 0.11 * s), STAR, STAR);
        }
        PrayerIcon::Sunrise => {
            push_setting_sun(&mut layers, p, s, 0.66, SUN_TOP, SUN_BOTTOM);
            // Three short rays above the rising sun.
            for angle in [-90.0f32, -140.0, -40.0] {
                let radians = angle.to_radians();
                let (dx, dy) = (radians.cos(), radians.sin());
                let a = (0.5 * s + dx * 0.36 * s, 0.66 * s + dy * 0.36 * s);
                let b = (0.5 * s + dx * 0.47 * s, 0.66 * s + dy * 0.47 * s);
                layers.push(capsule(p, a, b, 0.075 * s), SUN_TOP, SUN_BOTTOM);
            }
        }
        PrayerIcon::Dhuhr => {
            let angles = [0.0f32, 45.0, 90.0, 135.0, 180.0, 225.0, 270.0, 315.0];
            push_sun(&mut layers, p, s, (0.5 * s, 0.5 * s), 0.21, &angles, 0.33, 0.47, SUN_TOP, SUN_BOTTOM);
        }
        PrayerIcon::Asr => {
            // Lower, deeper sun with six rays, set a little to the left.
            let angles = [-90.0f32, -30.0, 30.0, 90.0, 150.0, 210.0];
            push_sun(
                &mut layers,
                p,
                s,
                (0.44 * s, 0.56 * s),
                0.18,
                &angles,
                0.30,
                0.42,
                DEEP_SUN_TOP,
                DEEP_SUN_BOTTOM,
            );
        }
        PrayerIcon::Maghrib => {
            push_setting_sun(&mut layers, p, s, 0.64, SUNSET_TOP, SUNSET_BOTTOM);
        }
    }
    layers
}

fn decode(pixel: u32) -> [f32; 4] {
    [
        ((pixel >> 24) & 0xFF) as f32 / 255.0,
        ((pixel >> 16) & 0xFF) as f32 / 255.0,
        ((pixel >> 8) & 0xFF) as f32 / 255.0,
        (pixel & 0xFF) as f32 / 255.0,
    ]
}

fn encode(value: [f32; 4]) -> u32 {
    let channel = |v: f32| (v * 255.0).round().clamp(0.0, 255.0) as u32;
    (channel(value[0]) << 24) | (channel(value[1]) << 16) | (channel(value[2]) << 8) | channel(value[3])
}

/// Composites `icon` onto a premultiplied ARGB buffer of `width` x `height`.
/// The icon fills a square of `size` pixels whose top-left corner is (`left`, `top`).
pub fn draw_prayer_icon(
    pixels: &mut [u32],
    width: i32,
    height: i32,
    icon: PrayerIcon,
    left: i32,
    top: i32,
    size: i32,
) {
    if size <= 0 {
        return;
    }
    let s = size as f32;
    for py in 0..size {
        for px in 0..size {
            let (x, y) = (left + px, top + py);
            if x < 0 || y < 0 || x >= width || y >= height {
                continue;
            }
            let p = (px as f32 + 0.5, py as f32 + 0.5);
            let layers = layers_for(icon, s, p);
            let t = (p.1 / s).clamp(0.0, 1.0);
            let index = (y * width + x) as usize;
            let mut dst = decode(pixels[index]);
            for layer in &layers.items[..layers.len] {
                let coverage = (0.5 - layer.distance).clamp(0.0, 1.0);
                if coverage <= 0.0 {
                    continue;
                }
                let colour = [
                    layer.top[0] + (layer.bottom[0] - layer.top[0]) * t,
                    layer.top[1] + (layer.bottom[1] - layer.top[1]) * t,
                    layer.top[2] + (layer.bottom[2] - layer.top[2]) * t,
                ];
                // Premultiplied "over" compositing.
                let inverse = 1.0 - coverage;
                dst = [
                    coverage + dst[0] * inverse,
                    colour[0] / 255.0 * coverage + dst[1] * inverse,
                    colour[1] / 255.0 * coverage + dst[2] * inverse,
                    colour[2] / 255.0 * coverage + dst[3] * inverse,
                ];
            }
            pixels[index] = encode(dst);
        }
    }
}
