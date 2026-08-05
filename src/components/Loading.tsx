import Image from "next/image";

const SIZE_CLASSES = {
  sm: { icon: "h-6 aspect-[2924/3540]", wrapper: "py-2" },
  md: { icon: "h-10 aspect-[2924/3540]", wrapper: "py-10" },
} as const;

// The gold ring (read as a tray by the owner) spins on its own center while
// the penguin underneath stays still - like a waiter spinning a tray in one
// hand, rather than the whole logo tumbling. Two PNG layers
// (public/logo-icon-penguin.png + logo-icon-ring.png, split from
// logo-icon.png by color) stacked at the same canvas size, so no
// repositioning is needed beyond the ring's own rotation center below
// (measured from the source file's actual ring bounding box).
const RING_TRANSFORM_ORIGIN = "66.2% 9%";

export default function Loading({ size = "md" }: { size?: keyof typeof SIZE_CLASSES }) {
  const { icon, wrapper } = SIZE_CLASSES[size];
  return (
    <div className={`flex items-center justify-center ${wrapper}`} role="status">
      <div className={`relative ${icon} animate-partiko-loading-bob`}>
        {/* The penguin PNG is white, drawn for the always-dark header - invert
            it to near-black on the light theme's near-white page background,
            where it would otherwise be nearly invisible. */}
        <Image
          src="/logo-icon-penguin.png"
          alt=""
          fill
          sizes="80px"
          className="object-contain invert dark:invert-0"
        />
        <Image
          src="/logo-icon-ring.png"
          alt=""
          fill
          sizes="80px"
          className="object-contain animate-partiko-loading-spin"
          style={{ transformOrigin: RING_TRANSFORM_ORIGIN }}
        />
      </div>
      <span className="sr-only">Betöltés…</span>
    </div>
  );
}
