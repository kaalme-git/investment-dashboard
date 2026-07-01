type Props = {
  size?: string;
  color?: string;
  className?: string;
};

const IconResearch = ({
  color = 'currentcolor',
  size = '1em',
  className,
}: Props) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M14 2H6C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM6 4H13L18 9V16.58L16.16 14.74C17.44 12.8 17.23 10.17 15.52 8.46C14.55 7.49 13.28 7 12 7C10.72 7 9.45 7.49 8.47 8.46C6.52 10.41 6.52 13.57 8.47 15.51C9.44 16.48 10.72 16.97 12 16.97C12.96 16.97 13.92 16.69 14.75 16.14L18 20H6V4ZM14.11 14.1C13.55 14.66 12.8 14.98 12 14.98C11.2 14.98 10.45 14.67 9.89 14.1C9.33 13.54 9.01 12.79 9.01 11.99C9.01 11.19 9.32 10.44 9.89 9.88C10.45 9.31 11.2 9 12 9C12.8 9 13.55 9.31 14.11 9.88C14.67 10.44 14.99 11.19 14.99 11.99C14.99 12.79 14.68 13.54 14.11 14.1Z"
        fill={color}
      />
    </svg>
  );
};

export default IconResearch;
