import React, { useState, Suspense, memo, useCallback } from 'react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import styles from './TestingDashboardPage.module.css';

// Lazy-loaded testing panels for better performance
const PatternManagementPanel = React.lazy(() => import('../components/testing/PatternManagementPanel'));
const ParameterTestingPanel = React.lazy(() => import('../components/testing/ParameterTestingPanel'));
const PerformanceMonitoringPanel = React.lazy(() => import('../components/testing/PerformanceMonitoringPanel'));
const ResultsDashboardPanel = React.lazy(() => import('../components/testing/ResultsDashboardPanel'));
const AutomatedTestingPanel = React.lazy(() => import('../components/testing/AutomatedTestingPanel'));

type TestingTab = 'patterns' | 'parameters' | 'performance' | 'results' | 'automation';

interface TestingDashboardPageProps {
  // Optional props for initial configuration
  initialTab?: TestingTab;
  showBreadcrumbs?: boolean;
}

const TestingDashboardPage: React.FC<TestingDashboardPageProps> = memo(({ 
  initialTab = 'patterns',
  showBreadcrumbs = true 
}) => {
  const [activeTab, setActiveTab] = useState<TestingTab>(initialTab);

  const handleTabChange = useCallback((tabId: TestingTab) => {
    setActiveTab(tabId);
  }, []);

  const tabs = [
    {
      id: 'patterns' as TestingTab,
      label: 'Pattern Management',
      description: 'Upload, edit, and manage test patterns',
      icon: '📁'
    },
    {
      id: 'parameters' as TestingTab,
      label: 'Parameter Testing',
      description: 'Test different 3D generation parameters',
      icon: '⚙️'
    },
    {
      id: 'performance' as TestingTab,
      label: 'Performance Monitoring',
      description: 'Monitor generation performance and metrics',
      icon: '📊'
    },
    {
      id: 'results' as TestingTab,
      label: 'Results Dashboard',
      description: 'View and analyze test results',
      icon: '📈'
    },
    {
      id: 'automation' as TestingTab,
      label: 'Automated Testing',
      description: 'Configure automated test suites',
      icon: '🤖'
    }
  ];

  const renderActivePanel = () => {
    switch (activeTab) {
      case 'patterns':
        return <PatternManagementPanel />;
      case 'parameters':
        return <ParameterTestingPanel />;
      case 'performance':
        return <PerformanceMonitoringPanel />;
      case 'results':
        return <ResultsDashboardPanel />;
      case 'automation':
        return <AutomatedTestingPanel />;
      default:
        return <PatternManagementPanel />;
    }
  };

  return (
    <div className={styles.testingDashboard} data-testid="testing-dashboard">
      {showBreadcrumbs && (
        <div className={styles.breadcrumbs}>
          <span className={styles.breadcrumbItem}>Home</span>
          <span className={styles.breadcrumbSeparator}>→</span>
          <span className={styles.breadcrumbItem}>Development</span>
          <span className={styles.breadcrumbSeparator}>→</span>
          <span className={styles.breadcrumbCurrent}>Enhanced Testing Interface</span>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Enhanced 3D Testing Interface</h1>
          <p className={styles.subtitle}>
            Comprehensive testing and validation tools for 3D model generation workflow
          </p>
        </div>
      </div>

      <div className={styles.tabNavigation}>
        <div className={styles.tabList} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => handleTabChange(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
            >
              <div className={styles.tabContent}>
                <span className={styles.tabIcon}>{tab.icon}</span>
                <div className={styles.tabText}>
                  <span className={styles.tabLabel}>{tab.label}</span>
                  <span className={styles.tabDescription}>{tab.description}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.panelContainer}>
        <div
          className={styles.panel}
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          <Suspense fallback={<LoadingSpinner message="Loading testing panel..." size="medium" />}>
            {renderActivePanel()}
          </Suspense>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.helpText}>
            <h3>Quick Tips</h3>
            <ul>
              <li><strong>Pattern Management:</strong> Upload CSV files or create patterns manually</li>
              <li><strong>Parameter Testing:</strong> Test different height, extrusion, and quality settings</li>
              <li><strong>Performance Monitoring:</strong> Track generation times and resource usage</li>
              <li><strong>Results Dashboard:</strong> Analyze test results and export reports</li>
              <li><strong>Automated Testing:</strong> Set up continuous testing and CI integration</li>
            </ul>
          </div>
          
          <div className={styles.statusIndicators}>
            <div className={styles.statusItem}>
              <div className={`${styles.statusDot} ${styles.online}`}></div>
              <span>Testing System Online</span>
            </div>
            <div className={styles.statusItem}>
              <div className={`${styles.statusDot} ${styles.ready}`}></div>
              <span>3D Engine Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestingDashboardPage;