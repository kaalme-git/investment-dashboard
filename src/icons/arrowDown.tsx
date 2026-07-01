const IconArrowDown = ({
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
        d="M9.16665 3.33325V13.4791L4.49998 8.81242L3.33331 9.99992L9.99998 16.6666L16.6666 9.99992L15.5 8.81242L10.8333 13.4791V3.33325H9.16665Z"
        fill={color}
      />
    </svg>
  );
};

export default IconArrowDown;
