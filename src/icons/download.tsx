const IconDownload = ({
  color = 'currentcolor',
  size = '1em',
}: {
  size?: string;
  color?: string;
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 13H4V18H20V13H22V18C22 19.11 21.11 20 20 20H4C2.9 20 2 19.11 2 18V13ZM12 16L17.55 10.54L16.13 9.13L13 12.25V3H11V12.25L7.88 9.13L6.46 10.55L12 16Z"
        fill={color}
      />
    </svg>
  );
};

export default IconDownload;
