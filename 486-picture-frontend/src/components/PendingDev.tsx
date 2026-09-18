import React from 'react';
import { Construction } from 'lucide-react';

interface PendingDevProps {
  title: string;
}

const PendingDev: React.FC<PendingDevProps> = ({ title }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white/80 p-10 animate-fade-in">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
        <Construction size={80} className="text-primary relative z-10" />
      </div>
      <h2 className="text-3xl font-bold mb-4 text-white">{title}</h2>
      <p className="text-white/60 text-lg max-w-md text-center">
        该功能正在紧张开发中，敬请期待...
      </p>
      <div className="mt-8 flex gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }}></span>
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></span>
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }}></span>
      </div>
    </div>
  );
};

export default PendingDev;