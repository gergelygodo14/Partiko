import Image from "next/image";

const SIZE_CLASSES = {
  sm: { icon: "h-6 w-auto", wrapper: "py-2" },
  md: { icon: "h-10 w-auto", wrapper: "py-10" },
} as const;

// Replaces the plain "Betöltés..." text everywhere - the logo spins (bob +
// spin are two separate CSS animations, see globals.css) instead, centered
// rather than left-aligned like the text was.
export default function Loading({ size = "md" }: { size?: keyof typeof SIZE_CLASSES }) {
  const { icon, wrapper } = SIZE_CLASSES[size];
  return (
    <div className={`flex items-center justify-center ${wrapper}`} role="status">
      <div className="animate-partiko-loading-bob">
        <Image
          src="/logo-icon.png"
          alt=""
          width={2924}
          height={3540}
          className={`${icon} animate-partiko-loading-spin`}
        />
      </div>
      <span className="sr-only">Betöltés…</span>
    </div>
  );
}
