/**
 * Types: width, height, fill, stroke
 * SVG attributes:
 * fill={color}
 * stroke={stroke}
 * strokeLinecap="round"
 * strokeLinejoin="round"
 * NOTE: icon grid is 14x14px -> base sice: 1.25em
 */

type Props = {
  size?: string;
  color?: string;
  stroke?: string;
};

const IconGlobe = ({
  stroke = 'currentColor',
  color = 'none',
  size = '1em',
}: Props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 14 14"
      width={size}
      height={size}
    >
      <circle
        cx="7"
        cy="7"
        r="6.5"
        fill={color}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1,9.5H2.75A1.75,1.75,0,0,0,4.5,7.75V6.25A1.75,1.75,0,0,1,6.25,4.5,1.75,1.75,0,0,0,8,2.75V.57"
        fill={color}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5,6.9a3.56,3.56,0,0,0-1.62-.4H9.75a1.75,1.75,0,0,0,0,3.5A1.25,1.25,0,0,1,11,11.25v.87"
        fill={color}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default IconGlobe;
