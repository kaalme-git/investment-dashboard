const IconArrowUp = ({
  size = '1em',
  color = 'currentColor',
}: {
  size?: string;
  color?: string;
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M9.16665 16.6666V6.52075L4.49998 11.1874L3.33331 9.99992L9.99998 3.33325L16.6666 9.99992L15.5 11.1874L10.8333 6.52075V16.6666H9.16665Z"
        fill={color}
      />
    </svg>
  );
};

export default IconArrowUp;
