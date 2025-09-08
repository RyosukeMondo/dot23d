import React from 'react';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 'medium',
  fullScreen = false 
}) => {
  const containerClass = fullScreen 
    ? `${styles.container} ${styles.fullScreen}`
    : styles.container;

  return (
    <div className={containerClass}>
      <div className={`${styles.spinner} ${styles[size]}`}>
        <div className={styles.spinnerInner}></div>
      </div>
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
};

export default LoadingSpinner;