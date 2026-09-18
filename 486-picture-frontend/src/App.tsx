import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import LoginView from './components/LoginView';
import RegisterView from './components/RegisterView';
import ResetView from './components/ResetView';
import Dashboard from './components/Dashboard';
import { ViewState } from './types';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { getCurrentLoginUser } from './services/user';
import ToastContainer from './components/Toast/ToastContainer';

const App: React.FC = () => {
  const auth = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const previousViewRef = useRef<ViewState | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    if (auth.isLoggedIn) {
      return ViewState.DASHBOARD;
    }
    // Handle unauthenticated routes on refresh
    if (location.pathname === '/register') {
      return ViewState.REGISTER;
    }
    if (location.pathname === '/reset-password') {
      return ViewState.RESET_PASSWORD;
    }
    return ViewState.LOGIN;
  });
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    useThemeStore.getState().init();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkLogin = async () => {
      if (auth.isLoggedIn && !cancelled) {
        setCurrentView(ViewState.DASHBOARD);
        setCheckingAuth(false);
        return;
      }
      const user = await getCurrentLoginUser();
      if (!cancelled) {
        if (user) {
          setCurrentView(ViewState.DASHBOARD);
        } else {
          if (location.pathname === '/register') {
            setCurrentView(ViewState.REGISTER);
          } else if (location.pathname === '/reset-password') {
            setCurrentView(ViewState.RESET_PASSWORD);
          } else {
            setCurrentView(ViewState.LOGIN);
          }
        }
        setCheckingAuth(false);
      }
    };
    checkLogin();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (currentView === ViewState.DASHBOARD) {
      return;
    }
    let title = '昴云';
    if (currentView === ViewState.LOGIN) {
      title = '昴云-登录';
    } else if (currentView === ViewState.REGISTER) {
      title = '昴云-注册';
    } else if (currentView === ViewState.RESET_PASSWORD) {
      title = '昴云-重置密码';
    }
    document.title = title;
  }, [currentView]);

  useEffect(() => {
    const previousView = previousViewRef.current;
    if (currentView === ViewState.DASHBOARD && previousView !== ViewState.DASHBOARD) {
      // 检查当前路径是否已经是仪表盘或相册相关路径
      const isDashboardPath = location.pathname.startsWith('/dashboard') || 
                              location.pathname.startsWith('/album') || 
                              location.pathname.startsWith('/album-profile') ||
                              location.pathname.startsWith('/album-members');

      // 只有当路径是根路径或登录/注册相关路径时，才跳转到默认画廊页
      // 如果已经在具体的 dashboard 路径下（如刷新页面），则保持当前路径
      if (!isDashboardPath || location.pathname === '/' || location.pathname === '/login') {
        navigate('/dashboard/gallery', { replace: true });
      }
    }
    previousViewRef.current = currentView;
  }, [currentView, navigate, location.pathname]);

  const renderView = () => {
    switch (currentView) {
      case ViewState.LOGIN:
        return (
          <Layout>
            <LoginView onChangeView={setCurrentView} />
          </Layout>
        );
      case ViewState.REGISTER:
        return (
          <Layout>
            <RegisterView onChangeView={setCurrentView} />
          </Layout>
        );
      case ViewState.RESET_PASSWORD:
        return (
          <Layout>
            <ResetView onChangeView={setCurrentView} />
          </Layout>
        );
      case ViewState.DASHBOARD:
        return <Dashboard onChangeView={setCurrentView} />;
      default:
        return (
          <Layout>
            <LoginView onChangeView={setCurrentView} />
          </Layout>
        );
    }
  };

  if (checkingAuth) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen">
      <div className="transition-all duration-500 ease-in-out h-full">
        {renderView()}
      </div>
      <ToastContainer />
    </div>
  );
};

export default App;
