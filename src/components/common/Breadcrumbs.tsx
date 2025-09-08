import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Breadcrumbs.module.css';

interface BreadcrumbItem {
  path: string;
  label: string;
}

interface BreadcrumbsProps {
  customItems?: BreadcrumbItem[];
  showHome?: boolean;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ 
  customItems,
  showHome = true 
}) => {
  const location = useLocation();

  const getDefaultBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    if (showHome) {
      breadcrumbs.push({ path: '/', label: 'Home' });
    }

    // Map common paths
    const pathMap: Record<string, string> = {
      'app': 'Integrated App',
      'dev': 'Development',
      'image-load': 'Image Load',
      'image-conversion': 'Image Conversion',
      'dot-edit': 'Dot Editor',
      'model-3d': '3D Model',
      'testing': 'Enhanced Testing'
    };

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = pathMap[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Skip intermediate segments for cleaner breadcrumbs
      if (segment === 'dev' && pathSegments.length > 2) {
        return; // Skip showing "Development" in breadcrumbs
      }
      
      breadcrumbs.push({
        path: currentPath,
        label: label
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = customItems || getDefaultBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs if there's only one item or less
  }

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb navigation">
      <ol className={styles.breadcrumbList}>
        {breadcrumbs.map((item, index) => (
          <li key={item.path} className={styles.breadcrumbItem}>
            {index < breadcrumbs.length - 1 ? (
              <>
                <Link 
                  to={item.path} 
                  className={styles.breadcrumbLink}
                  aria-label={`Navigate to ${item.label}`}
                >
                  {item.label}
                </Link>
                <span className={styles.breadcrumbSeparator} aria-hidden="true">
                  →
                </span>
              </>
            ) : (
              <span className={styles.breadcrumbCurrent} aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;