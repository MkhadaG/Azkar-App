import type { CSSProperties } from "react";
import { iconPaths, type IconName } from "./icons";

export type { IconName };

interface IconProps {
  name: IconName;
  size?: number;
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Inline SVG icon. `flip` mirrors it in right-to-left layouts (for arrows). */
export function Icon({ name, size = 20, flip = false, className = "", style }: IconProps) {
  return (
    <svg
      className={`icon${flip ? " icon-flip" : ""} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
