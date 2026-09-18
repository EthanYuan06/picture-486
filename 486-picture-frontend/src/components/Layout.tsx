import React, { useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevScrollbarGutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.scrollbarGutter = 'auto';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.scrollbarGutter = prevScrollbarGutter;
    };
  }, []);

  return (
    <div className="relative h-screen w-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat bg-fixed"
        style={{
          backgroundImage: 'url("https://yuluo-picture-1383397986.cos.ap-guangzhou.myqcloud.com/login_background/login_background.webp")',
          filter: 'brightness(0.85)',
        }}
      >
        {/* Overlay to ensure text readability */}
        <div
          className="absolute inset-0 transition-all duration-300"
          style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}
        ></div>
      </div>

      {/* Main Card Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {children}
      </div>
    </div>
  );
};

export default Layout;
