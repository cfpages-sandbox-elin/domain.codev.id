import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'sm', color = 'border-white' }) => {
  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };
  
  return (
    <div
      className={`animate-spin rounded-full border-b-2 ${sizeClasses[size]} ${color}`}
      role="status"
      aria-label="loading"
    ></div>
  );
};

export default Spinner;